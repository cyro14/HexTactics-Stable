# ==========================================
# VERIFICADOR DE TELAS (screenshot -> asserts)
# Uso: python verify.py <caminho.png> <tipo-de-tela> [largura esperada]
# Tipos: menu | mode | chooser | mode-mobile
# Saída: linhas [PASS]/[FAIL] + RESULT: OK/BROKEN (exit code 0/1)
# ==========================================
from PIL import Image
import sys

path, kind = sys.argv[1], sys.argv[2]
img = Image.open(path).convert("RGB")
w, h = img.size

def count(x0, x1, y0, y1, cond, step=2):
    return sum(1 for y in range(y0, y1, step) for x in range(x0, x1, step) if cond(*img.getpixel((x, y))))

def sky_painted():
    # céu visível nas margens do topo (azul escuro, não branco nem preto puro)
    pts = [img.getpixel((int(w * fx), 8)) for fx in (0.05, 0.5, 0.95)]
    return any(15 <= b <= 120 and b >= r and r < 80 for (r, g, b) in pts)

def moon(rmin=150):
    mx, my = int(w * 0.80), int(h * 0.20)
    r, g, b = img.getpixel((mx, my))
    return r > rmin and b < 230

def gold_band(y0f, y1f, min_hits):
    return count(0, w, int(h * y0f), int(h * y1f), lambda r, g, b: r > 180 and g > 140 and b < 100) > min_hits

def title_upper_half(min_hits=None):
    # threshold escala com a largura (titulo menor em telas pequenas)
    if min_hits is None:
        min_hits = max(20, w // 32)
    return count(0, w, 0, h // 2, lambda r, g, b: r > 200 and g > 160 and b < 120) > min_hits

checks = []

if kind == "menu":
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("lua_no_cenario", moon()),
        ("logo_na_metade_superior", title_upper_half()),
        ("botao_jogar_dourado", gold_band(0.30, 0.75, 60)),
    ]
elif kind == "mode":
    blue = count(0, int(w * 0.55), 0, h, lambda r, g, b: b > 120 and r < 100)
    red = count(int(w * 0.55), w, 0, h, lambda r, g, b: r > 140 and g < 90 and b < 80)
    orange = count(int(w * 0.55), w, 0, h, lambda r, g, b: r > 170 and 80 < g < 160 and b < 70)
    sprites = count(int(w * 0.5), w, 60, int(h * 0.7), lambda r, g, b: r > 100 and g > 90 and b > 80, 4)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("lua_no_cenario", moon()),
        ("titulo_escolha_seu_caminho", title_upper_half(20)),
        ("acento_azul_campanha", blue > 30),
        ("acento_vermelho_roguelite", red > 20),
        ("acento_laranja_duelo", orange > 5),
        ("arte_dos_cards", sprites > 30),
        ("botoes_inferiores", gold_band(0.80, 1.0, 10)),
    ]
elif kind == "chooser":
    continue_btn = count(0, w, int(h * 0.30), int(h * 0.70), lambda r, g, b: r > 180 and g > 140 and b < 110)
    danger = count(0, w, int(h * 0.30), int(h * 0.75), lambda r, g, b: r > 200 and 140 < g < 190 and 120 < b < 180)
    # lua translúcida através do backdrop (prova que o fundo animado continua atrás)
    mx, my = int(w * 0.80), int(h * 0.20)
    px = img.getpixel((mx, my))
    checks += [
        ("botao_continuar_dourado", continue_btn > 100),
        ("botao_comecar_novamente_vermelho", danger > 30),
        ("fundo_animado_atras_do_backdrop", px[0] > 35 and px[0] >= px[2]),
        ("modo_visivel_abaixo", count(0, w, int(h * 0.7), h, lambda r, g, b: r > 180 and g > 140 and b < 100) > 0),
    ]
elif kind == "leader":
    # tela de seleção de líder: badge do modo (azul = campanha), título,
    # CARROSSEL UNIVERSAL (um card focado + setas/contador em qualquer
    # resolução — o grid antigo escondia as artes em telas apertadas)
    mobile = w <= 760
    blue_badge = count(0, w, 0, int(h * 0.22), lambda r, g, b: b > 120 and r < 100)
    gold_names = count(0, w, int(h * 0.20), int(h * 0.95), lambda r, g, b: r > 160 and g > 120 and b < 100)
    # retratos: conteúdo claro/médio (sprites escuros contam), mas não
    # branco puro (página de erro do Chrome é branca)
    portraits = count(0, w, int(h * 0.20), int(h * 0.95), lambda r, g, b: r > 80 and g > 60 and b > 40 and not (r > 240 and g > 240 and b > 240), 4)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("titulo_selecione_lider", title_upper_half(max(25, w // 32))),
        ("selo_do_modo_campanha", blue_badge > 3),
        ("nomes_dos_lideres_dourados", gold_names > 15),
        ("retratos_presentes", portraits > max(30, w // 16)),
        ("botao_voltar", gold_band(0.85, 1.0, 10)),
    ]
    # carrossel: setas de navegação + contador — em TODAS as resoluções
    nav_gold = count(0, w, int(h * 0.7), h, lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
    checks += [("setas_do_carrossel", nav_gold > 20)]
elif kind == "route":
    # mapa de exploração: nós hexagonais alcançáveis pulsando dourado,
    # moldura, título; a integridade (nós/linhas) é validada via DOM
    gold_nodes = count(0, w, int(h * 0.35), h, lambda r, g, b: r > 170 and g > 130 and b < 110, 2)
    node_labels = count(0, w, int(h * 0.35), h, lambda r, g, b: b > 120 and r < 110 and g < 140, 2)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("titulo_mapa_exploracao", title_upper_half(max(20, w // 40))),
        ("nos_alcancaveis_dourados", gold_nodes > 25),
        ("rotulos_dos_nos", node_labels > 4),
    ]
elif kind == "mode-mobile":
    blue = count(0, w, 0, h, lambda r, g, b: b > 120 and r < 100)
    red = count(0, w, 0, h, lambda r, g, b: r > 140 and g < 90 and b < 80)
    gold = count(0, w, 0, int(h * 0.25), lambda r, g, b: r > 170 and g > 130 and b < 110, 2)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("titulo_visivel", gold > 8),
        ("cards_empilhados_campanha_roguelite", blue > 20 and red > 5),
    ]
elif kind == "hexis":
    # mapa de Hexis: fragmentos de bioma pintados, azul=conquistado,
    # vermelho=fronteira atacável, verde=florestas, dourado=rótulos/rotas
    blue = count(0, w, 0, h, lambda r, g, b: b > 120 and r < 100)
    red = count(0, w, 0, h, lambda r, g, b: r > 150 and g < 90 and b < 80)
    green = count(0, w, 0, h, lambda r, g, b: r < 120 and 80 < g < 190 and b < 110)
    gold = count(0, w, 0, h, lambda r, g, b: r > 160 and g > 120 and b < 100)
    ocean = count(0, w, int(h * 0.2), int(h * 0.9), lambda r, g, b: 20 < b and r < 30 and g < 40, 4)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("titulo_hexis", title_upper_half(max(20, w // 40))),
        ("oceano_do_vazio_pintado", ocean > max(60, w // 8)),
        ("fragmento_floresta_verde", green > max(40, w // 10)),
        ("territorios_conquistados_azuis", blue > max(25, w // 20)),
        ("fronteira_atacavel_vermelha", red > max(20, w // 24)),
        ("rotas_e_rotulos_dourados", gold > max(40, w // 12)),
    ]
elif kind == "prep":
    # tela de preparação: abas sempre visíveis (Campo ativa = dourada),
    # selo do próximo combate (Elite = vermelho #e05a48), painel ativo e
    # botão de avançar. O selo fica na topline, logo abaixo do título
    # (y ~0.35h; calibrado por screenshot — não no topo da tela).
    tab_gold = count(0, w, int(h * 0.18), int(h * 0.32), lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
    elite_red = count(0, w, int(h * 0.28), int(h * 0.52), lambda r, g, b: r > 180 and g < 140 and b < 120, 2)
    checks += [
        ("ceu_pintado_nas_margens", sky_painted()),
        ("titulo_preparacao", title_upper_half(max(20, w // 40))),
        ("aba_campo_ativa_dourada", tab_gold > 15),
        ("selo_elite_vermelho", elite_red > 4),
        ("botao_avancar_combate", gold_band(0.60, 1.0, 40)),
    ]
elif kind == "battle":
    # tela de batalha real: mapa hexagonal + top-bar + painel lateral
    # direito (Wesnoth) + crônica no TOPO-DIREITA (abaixo da barra) +
    # action bar bottom-left (utilitários + magias em slots LoL)
    mobile = w <= 760
    # top-bar: badge de turno + chip de ouro dourados
    top_gold = count(0, w, int(h * 0.02), int(h * 0.15), lambda r, g, b: r > 170 and g > 130 and b < 100, 2)
    if mobile:
        # modo retrato: mini-card no topo (foto 40px + nome + HP/MP micro),
        # stats completos no modal; crônica recolhida abaixo do card;
        # action bar bottom-left; Pronto é FAB no canto inferior direito
        panel_gold = count(0, w, int(h * 0.055), int(h * 0.17), lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
        hp_red = count(0, w, int(h * 0.055), int(h * 0.17), lambda r, g, b: r > 150 and g < 110 and b < 100, 2)
        mp_blue = count(0, w, int(h * 0.055), int(h * 0.17), lambda r, g, b: r < 130 and g > 80 and b > 150, 2)
        ready_gold = count(w - 130, w, h - 110, h, lambda r, g, b: r > 180 and g > 140 and b < 100, 2)
        # crônica recolhida no topo-direita (top: ~134px)
        log_gold = count(int(w * 0.3), w, int(h * 0.155), int(h * 0.24), lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
        # action bar: canto inferior esquerdo
        action_gold = count(0, int(w * 0.62), h - 90, h, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
        panel_thresh = 3
    else:
        # painel lateral compacto: 232px colados à direita, altura CHEIA
        # (58px até a base) — Pronto ancorado na base do painel
        panel_gold = count(w - 240, w, 56, h, lambda r, g, b: r > 170 and g > 120 and b < 100, 2)
        hp_red = count(w - 240, w, 56, h, lambda r, g, b: r > 150 and g < 110 and b < 100, 2)
        mp_blue = count(w - 240, w, 56, h, lambda r, g, b: r < 130 and g > 80 and b > 150, 2)
        ready_gold = count(w - 240, w, int(h * 0.7), h, lambda r, g, b: r > 180 and g > 140 and b < 100, 2)
        # crônica: TOPO-ESQUERDA (left: 12, top: 66) — desktop
        log_gold = count(0, 380, int(h * 0.07), int(h * 0.30), lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
        # action bar: bottom-left (left: 12, bottom: 12)
        action_gold = count(0, int(w * 0.45), h - 90, h, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
        panel_thresh = 15
    # lobo de mana invocado (sprite procedural): o battleSetup o SELECIONA,
    # então o retrato no painel/card mostra a pelagem violeta
    if mobile:
        # mini-card: retrato 40px no topo-esquerda do card
        wolf_violet = count(0, int(w * 0.3), int(h * 0.05), int(h * 0.17),
                            lambda r, g, b: 50 < r < 160 and 35 < g < 130 and 90 < b < 200 and b > r, 2)
    else:
        # retrato 76px no topo do painel lateral direito
        wolf_violet = count(w - 240, w, 56, int(h * 0.28),
                            lambda r, g, b: 50 < r < 160 and 35 < g < 130 and 90 < b < 200 and b > r, 2)
    checks += [
        ("topbar_ouro_mana", top_gold > 2),
        ("hud_barras_hp_mp", hp_red > 2 and mp_blue > 2),
        ("cronica_topo_esquerda", log_gold > 2),
        ("action_bar_inferior", action_gold > 2),
        ("botao_pronto_dourado", ready_gold > 5),
        ("painel_lateral_detalhes", panel_gold > panel_thresh),
        ("lobo_de_mana_invocado", wolf_violet > 8),
    ]
elif kind == "battle-details":
    # modal "Detalhes da Unidade" aberto sobre a batalha (a "outra tela"
    # dos stats no modo retrato): backdrop escurecido + bloco Status
    # Atual com retrato, barras HP/MP/XP, chips e título dourado
    total_samples = (w // 4) * (h // 4)
    dark = count(0, w, 0, h, lambda r, g, b: r < 50 and g < 50 and b < 55, 4)
    gold = count(0, w, 0, h, lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
    hp_red = count(0, w, 0, h, lambda r, g, b: r > 150 and g < 110 and b < 100, 2)
    xp_green = count(0, w, 0, h, lambda r, g, b: r < 120 and 80 < g < 190 and b < 110, 2)
    checks += [
        ("modal_escurecendo_a_tela", dark > total_samples // 2),
        ("titulo_e_dourados_do_modal", gold > 20),
        ("barra_hp_no_status_atual", hp_red > 2),
        ("barra_xp_no_status_atual", xp_green > 2),
    ]
elif kind == "pause":
    # menu de pausa estilo Wesnoth sobre a batalha: backdrop escurecido,
    # título dourado, botão Retornar (primary gold) e Abandonar vermelho
    gold_title = count(0, w, int(h * 0.08), int(h * 0.50), lambda r, g, b: r > 190 and g > 150 and b < 120, 2)
    primary_gold = count(int(w * 0.25), int(w * 0.75), int(h * 0.30), int(h * 0.92), lambda r, g, b: r > 180 and g > 140 and b < 100, 2)
    red_quit = count(0, w, int(h * 0.45), h, lambda r, g, b: r > 150 and g < 110 and b < 90, 2)
    dark_bg = count(0, int(w * 0.05), int(h * 0.02), int(h * 0.10), lambda r, g, b: r < 80 and g < 80 and b < 90, 2)
    checks += [
        ("backdrop_escurecido", dark_bg > 80),
        ("titulo_pausado_dourado", gold_title > 25),
        ("botao_retornar_dourado", primary_gold > 60),
        ("botao_abandonar_vermelho", red_quit > 8),
    ]
else:
    print(f"[FAIL] tipo desconhecido: {kind}")
    sys.exit(1)

ok = True
for name, val in checks:
    status = "PASS" if val else "FAIL"
    if not val:
        ok = False
    print(f"[{status}] {kind} {w}x{h}: {name}")

print(f"RESULT: {'OK' if ok else 'BROKEN'} - {kind} {w}x{h}")
sys.exit(0 if ok else 1)
