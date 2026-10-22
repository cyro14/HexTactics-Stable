# ==========================================
# GERADOR PROCEDURAL DE SPRITES v2 — Biomancer Tactics
# Estilo "16-bit pintado" (compatível com a arte existente):
#   - desenho em supersampling 4x com formas suaves -> LANCZOS downscale
#     (bordas anti-aliased, ~milhares de cores, como o lobo original 108x81)
#   - sombreamento por gradiente + centenas de pinceladas de pelagem
#   - fundo sólido (46,46,45): o engine faz chroma-key (tolerância 20),
#     portanto NENHUMA cor interna pode ter os 3 canais em (26,66)
#   - determinístico por seed: mesma seed => mesma arte (versionável)
#
# Uso:  python tools/generate_sprites.py
#
# COMO EDITAR: a anatomia está em wolf_shapes() (coordenadas na grade final
# 108x81, multiplicadas por SS=4) e as cores nas paletas NATURAL/MANA.
# ==========================================
import os
import random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNITS_DIR = os.path.join(ROOT, 'img', 'units')
ART_DIR = os.path.join(ROOT, 'test', 'artifacts')

SS = 4                 # supersampling
W, H = 108, 81         # resolução final (igual ao lobo original)
BG = (46, 46, 45)      # fundo sólido do chroma-key (convenção da arte)


# ---------- paletas (nenhuma cor pode cair em (26,66) nos 3 canais,
# mesmo APÓS o jitter de pincelada — por isso os escuros são bem escuros) ----------
NATURAL = {
    'outline': (14, 13, 15), 'shadow': (20, 18, 20), 'fur_d': (22, 20, 22),
    'mid': (78, 74, 72), 'light': (108, 103, 98), 'vlight': (128, 124, 118),
    'belly': (120, 116, 110), 'brown': (92, 78, 60), 'brown_d': (26, 20, 17),
    'eye': (210, 150, 40), 'eye_d': (30, 22, 14), 'nose': (10, 9, 11),
    'fang': (185, 180, 172), 'claw': (150, 145, 138),
}

MANA = {
    'outline': (15, 12, 26), 'shadow': (20, 15, 38), 'fur_d': (24, 18, 44),
    'mid': (78, 62, 128), 'light': (108, 92, 168), 'vlight': (130, 114, 192),
    'belly': (150, 132, 210), 'brown': (92, 70, 150), 'brown_d': (24, 16, 40),
    'eye': (96, 240, 220), 'eye_d': (16, 60, 70), 'nose': (12, 9, 22),
    'fang': (200, 190, 225), 'claw': (170, 155, 215),
}


# ---------- utilidades ----------
def in_chroma_window(r, g, b):
    """janela que o engine remove: |c-46|<20 nos 3 canais"""
    return abs(r - 46) < 20 and abs(g - 46) < 20 and abs(b - 46) < 20


def jitter(rng, col, amt):
    """varia a cor em +/- amt por canal, SEMPRE fora da janela do chroma-key
    (re-jittera; no limite clampa o canal para <=26 ou >=66)"""
    c = col[:3]
    for _ in range(8):
        c = tuple(max(0, min(255, ch + rng.randint(-amt, amt))) for ch in col[:3])
        if not in_chroma_window(*c):
            return c
    return tuple(min(ch, 26) if ch < 46 else max(ch, 66) for ch in c)


def trace_outline(sil):
    """células da silhueta com vizinho 4 fora (contorno)"""
    return {p for p in sil
            if (p[0]-1, p[1]) not in sil or (p[0]+1, p[1]) not in sil
            or (p[0], p[1]-1) not in sil or (p[0], p[1]+1) not in sil}


# ---------- anatomia do lobo (coordenadas na grade FINAL, x4 internamente) ----------
# Convenção do original: voltado para a ESQUERDA, corpo longo e baixo (~2:1).
def wolf_shapes(rng):
    """retorna dict de partes geométricas em coordenadas SS"""
    s = SS

    def E(cx, cy, rx, ry):
        return ('E', cx * s, cy * s, rx * s, ry * s)

    def P(*pts):
        return ('P', [(x * s, y * s) for x, y in pts])

    ear_a = rng.uniform(-6, 6)      # jitter procedural das orelhas
    ear_b = rng.uniform(-5, 5)      # (mesma seed => mesmo jitter)
    tail_c = rng.uniform(-10, 10)   # curvatura da cauda

    return {
        # tronco longo e baixo
        'body':   E(46, 51, 30, 12),
        'chest':  E(28, 52, 13, 13),           # peito mais fundo à frente
        'haunch': E(63, 50, 14, 13),           # quartos traseiros
        # cabeça alta à esquerda
        'head':   E(16, 33, 10.5, 9.5),
        'neck':   P((12, 36), (24, 30), (34, 44), (30, 58), (14, 52)),
        # focinho apontando à esquerda
        'snout':  P((2, 33), (15, 30), (17, 41), (6, 42)),
        'jaw':    P((3, 38), (16, 40), (15, 45), (5, 44)),
        # orelhas
        'ear1':   P((10, 25), (13 + ear_a * .2, 14), (19, 24)),
        'ear2':   P((17, 23), (22 + ear_b * .2, 13), (26, 23)),
        # cauda bushy à direita
        'tail':   P((74, 44), (88 + tail_c * .3, 30 + tail_c * .2), (100, 24), (97, 40), (82, 52)),
        # pernas: próximas (claras) e afastadas (escuras)
        'legfn':  P((30, 58), (36, 58), (34, 76), (28, 76)),
        'legrn':  P((66, 58), (72, 58), (71, 76), (64, 76)),
        'legff':  P((38, 58), (43, 58), (42, 74), (37, 74)),
        'legrf':  P((74, 58), (79, 58), (79, 74), (73, 74)),
        # patas (levemente à frente)
        'paw_f':  P((26, 74), (37, 74), (37, 78), (25, 78)),
        'paw_r':  P((62, 74), (73, 74), (73, 78), (61, 78)),
    }


def rasterize(shapes):
    """converte as partes em conjuntos de pixels SS"""
    sil = set()
    meta = {}
    for name, sh in shapes.items():
        img = Image.new('L', (W * SS, H * SS), 0)
        d = ImageDraw.Draw(img)
        if sh[0] == 'E':
            d.ellipse([sh[1] - sh[3], sh[2] - sh[4], sh[1] + sh[3], sh[2] + sh[4]], fill=255)
        else:
            d.polygon(sh[1], fill=255)
        pts = set()
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y]:
                    pts.add((x, y))
        sil |= pts
        meta[name] = pts
    return sil, meta


# ---------- pintura ----------
def paint(rng, pal, sil, meta):
    """pinta a silhueta com gradiente + pinceladas; retorna imagem RGB SS"""
    img = Image.new('RGB', (W * SS, H * SS), BG)
    d = ImageDraw.Draw(img)

    ys = [p[1] for p in sil]
    y_lo, y_hi = min(ys), max(ys)

    # 1) tom base: gradiente dorso(claro) -> ventral(escuro)
    for p in sorted(sil):
        t = (p[1] - y_lo) / max(1, (y_hi - y_lo))
        if t < 0.30:
            col = pal['light']
        elif t < 0.62:
            col = pal['mid']
        else:
            col = pal['shadow']
        d.point(p, fill=jitter(rng, col, 5))

    def fill_part(name, col, amt=6, only=None):
        for p in meta.get(name, set()):
            if only and not only(p):
                continue
            d.point(p, fill=jitter(rng, col, amt))

    # 2) manchas marrons no dorso (tinta quente do lobo original)
    for name in ('body', 'haunch', 'neck'):
        for p in meta.get(name, set()):
            if rng.random() < 0.14 and p[1] < y_lo + (y_hi - y_lo) * 0.45:
                d.point(p, fill=jitter(rng, pal['brown'], 10))

    # 3) barriga clara + peito
    fill_part('chest', pal['belly'], 7, only=lambda p: p[1] > y_lo + (y_hi - y_lo) * .55)
    for p in meta.get('body', set()):
        if p[1] > y_hi - (y_hi - y_lo) * 0.22 and rng.random() < 0.7:
            d.point(p, fill=jitter(rng, pal['belly'], 8))

    # 4) cabeça: nuca clara, focinho, suígas
    for p in meta.get('head', set()):
        if p[0] > 15 * SS and rng.random() < 0.5:
            d.point(p, fill=jitter(rng, pal['vlight'], 8))
    fill_part('snout', pal['mid'], 7)
    fill_part('jaw', pal['belly'], 6)
    for p in meta.get('neck', set()):
        if p[0] < 22 * SS and rng.random() < 0.3:
            d.point(p, fill=jitter(rng, pal['vlight'], 9))

    # 5) orelhas: externa média, interna escura
    for e in ('ear1', 'ear2'):
        ep = meta.get(e, set())
        if not ep:
            continue
        xs = [p[0] for p in ep]
        for p in ep:
            inner = all((p[0] + dx, p[1] + dy) in ep for dx, dy in ((1, 1), (-1, 1)))
            d.point(p, fill=jitter(rng, pal['shadow'] if inner else pal['mid'], 5))

    # 6) cauda: bushy — pinceladas
    tp = sorted(meta.get('tail', set()))
    if tp:
        x_split = 88 * SS
        for p in tp:
            d.point(p, fill=jitter(rng, pal['mid'] if p[0] < x_split else pal['shadow'], 8))
        for _ in range(220):
            p = rng.choice(tp)
            d.point(p, fill=jitter(rng, pal['light'], 10))

    # 7) pernas afastadas: sombra; próximas: tom médio
    for name in ('legff', 'legrf'):
        fill_part(name, pal['shadow'], 5)
    for name in ('legfn', 'legrn'):
        fill_part(name, pal['mid'], 6)
    for name in ('paw_f', 'paw_r'):
        for p in meta.get(name, set()):
            d.point(p, fill=jitter(rng, pal['brown_d'] if rng.random() < .5 else pal['shadow'], 5))

    # 8) pinceladas de pelagem no tronco (textura "16-bit pintado")
    body_all = sorted(meta.get('body', set()) | meta.get('chest', set()) |
                      meta.get('haunch', set()) | meta.get('neck', set()))
    for _ in range(900):
        x, y = rng.choice(body_all)
        ln = rng.randint(3, 7)
        col = pal['light'] if rng.random() < 0.35 else (pal['mid'] if rng.random() < 0.6 else pal['fur_d'])
        col = jitter(rng, col, 9)
        for i in range(ln):
            q = (x + i, y + rng.randint(-1, 1))
            if q in sil:
                d.point(q, fill=col)

    # 9) olho (com brilho) + nariz + boca + presas
    eye = (int(14 * SS), int(31 * SS))
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            p = (eye[0] + dx * 2, eye[1] + dy)
            if p in sil:
                d.point(p, fill=pal['eye_d'] if max(abs(dx), abs(dy)) > 1 else pal['eye'])
    glint = (eye[0] - 2, eye[1] - 1)
    if glint in sil:
        d.point(glint, fill=(235, 230, 215))
    nose = (int(2 * SS), int(35 * SS))
    for dx in range(0, 6):
        for dy in range(0, 5):
            p = (nose[0] + dx, nose[1] + dy)
            if p in sil:
                d.point(p, fill=pal['nose'])
    for p in [(int(6 * SS), int(40 * SS)), (int(10 * SS), int(41 * SS))]:
        if p in sil:
            d.point(p, fill=pal['nose'])
    for p in [(int(8 * SS), int(43 * SS)), (int(11 * SS), int(43 * SS))]:
        if p in sil:
            d.point(p, fill=pal['fang'])

    # 10) contorno escuro na borda da silhueta
    for p in trace_outline(sil):
        d.point(p, fill=jitter(rng, pal['outline'], 4))
    for p in trace_outline(sil):
        for dx, dy in ((1, 0), (0, 1)):
            q = (p[0] + dx, p[1] + dy)
            if q not in sil and rng.random() < 0.35:
                d.point(q, fill=pal['outline'])

    return img


# ---------- validação + reparo ----------
def validate_final(img, pal, name, sil):
    """
    Cores INTERNAAS na janela do chroma-key virariam buracos transparentes
    no jogo. Misturas de BORDA (anti-alias contra o fundo, ou pinceladas
    escuras+claras que o LANCZOS funde) são legítimas — o engine as recorta
    como na arte original. Pixels interiores são REPARADOS (clamped para
    fora da janela) e contabilizados.
    """
    px = img.load()
    w, h = img.size

    def vizinho_de_fundo(x, y):
        """fundo a até 13 SS px (~janela do kernel LANCZOS 4x)?"""
        cx, cy = x * SS, y * SS
        for dy in range(-13, SS + 13):
            for dx in range(-13, SS + 13):
                if (cx + dx, cy + dy) not in sil:
                    return True
        return False

    repairs = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if (r, g, b) == BG:
                continue
            if not in_chroma_window(r, g, b):
                continue
            if vizinho_de_fundo(x, y):
                continue  # blend de borda — legítimo
            # interior real: empurra para fora da janela (lado mais próximo)
            avg = (r + g + b) // 3
            if avg < 46:
                px[x, y] = (min(r, 26), min(g, 26), min(b, 26))
            else:
                px[x, y] = (max(r, 66), max(g, 66), max(b, 66))
            repairs += 1
    # re-verifica: nenhuma cor interna pode ter sobrado na janela
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y][:3]
            if (r, g, b) != BG and in_chroma_window(r, g, b) and not vizinho_de_fundo(x, y):
                raise AssertionError(
                    f'{name}: cor INTERNA {px[x,y][:3]} em ({x},{y}) sobreviveu ao reparo!')
    uniq = len(set(px[x, y][:3] for y in range(0, h, 2) for x in range(0, w, 2)))
    assert uniq > 400, f'{name}: poucas cores ({uniq}) — voltou ao 8-bit!'
    print(f'  {name}: {uniq} cores unicas (1/4) | {repairs} px interiores reparados — look pintado OK')


# ---------- registro ----------
SPRITES = [
    {'name': 'Lobo', 'file': 'lobo.png', 'seed': 11, 'palette': NATURAL},
    {'name': 'Lobo de Mana', 'file': 'lobo_de_mana.png', 'seed': 11, 'palette': MANA},
]


def main():
    os.makedirs(UNITS_DIR, exist_ok=True)
    os.makedirs(ART_DIR, exist_ok=True)
    for spr in SPRITES:
        rng = random.Random(spr['seed'])
        shapes = wolf_shapes(rng)
        sil, meta = rasterize(shapes)
        img = paint(rng, spr['palette'], sil, meta)
        # downscale LANCZOS: anti-alias suave -> estilo "16-bit pintado"
        final = img.resize((W, H), Image.LANCZOS)
        base = Image.new('RGB', (W, H), BG)
        base.paste(final, (0, 0))
        validate_final(base, spr['palette'], spr['name'], sil)
        out = os.path.join(UNITS_DIR, spr['file'])
        base.save(out)
        # preview x3 para o olho humano
        prev = base.resize((W * 3, H * 3), Image.NEAREST)
        prev.save(os.path.join(ART_DIR, 'preview_' + spr['file']))
        print(f'[OK] {spr["name"]} -> {spr["file"]} ({W}x{H}, estilo pintado)')
    print('Sprites gerados com sucesso.')


if __name__ == '__main__':
    main()