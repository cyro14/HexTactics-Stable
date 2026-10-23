# ==========================================
# GERADOR PROCEDURAL DOS TILES ESPECIAIS — Biomancer Tactics
# Gera os 8 terrains com customSprite (linha única, N variações por sheet),
# harmonizados com o tileset principal ATUAL (paletas amostradas dele:
# água turquesa, deserto dourado, savana laranja) e na MESMA célula
# 219x253 (aspecto √3/2 = bbox do hex, encaixe exato).
#
# Contrato (data.js customSprite):
#   agua_eletrificada (6) | areia_movedica (6) | fenda_lava (6)
#   fenda_mana (6) | recife (6) | jazida_dna (6)
#   jazida_ouro (3) | mercado_negro (5)
#
# Uso: python tools/generate_special_tiles.py
# Determinístico por seed; validação anti-'um quarto' embutida.
# ==========================================
import os
import math
import random
import statistics
from PIL import Image

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_tileset import Painter, base, blotches, shade, lerp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'img', 'tiles')

CW, CH = 219, 253      # mesma célula do tileset principal atual
SS = 2                 # pinta em 438x506, reduz LANCZOS

# paletas amostradas do tileset principal do usuário
WATER_MID = (59, 181, 164)     # água turquesa
SEA_MID = (11, 125, 181)      # mar profundo
DESERT_MID = (222, 189, 70)    # areia dourada
ROCK_MID = (105, 115, 97)      # rocha esverdeada da montanha


def rng_for(name, col):
    return random.Random(hash(name) % 9999 + col * 131 + 17)


def jagged(rng, x0, y0, x1, y1, segs, amp):
    """polilinha serrilhada entre dois pontos (raios/fissuras)"""
    pts = [(x0, y0)]
    for i in range(1, segs):
        t = i / segs
        x = x0 + (x1 - x0) * t + rng.uniform(-amp, amp)
        y = y0 + (y1 - y0) * t + rng.uniform(-amp, amp)
        pts.append((x, y))
    pts.append((x1, y1))
    return pts


# ---------- pintores dos especiais ----------
def agua_eletrificada(ctx, w, h, rng):
    mid = shade(WATER_MID, .72)
    base(ctx, w, h, mid, 1.02, .78)
    # profundidade: mais escuro no fundo (duas camadas de água)
    ov = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    od.rectangle([0, h * .55, w, h], fill=(10, 40, 70, 55))
    ctx._image.paste(Image.alpha_composite(ctx._image.convert('RGBA'), ov).convert('RGB'), (0, 0))
    # ondas em duas camadas (base larga + crista clara)
    for _ in range(10):
        y0 = rng.uniform(10, h - 10)
        amp = rng.uniform(3, 8)
        pts = [(i, y0 + math.sin(i / 13 + y0) * amp) for i in range(0, w + 4, 4)]
        ctx.line(pts, fill=shade(WATER_MID, 1.15), width=4)
        pts2 = [(x, y - 2) for x, y in pts]
        ctx.line(pts2, fill=shade(WATER_MID, 1.35), width=2)
    # espuma nas cristas
    for _ in range(14):
        x, y = rng.uniform(6, w - 6), rng.uniform(10, h - 10)
        ctx.ellipse([x - 3, y - 2, x + 3, y + 2], fill=(190, 235, 250, 120))
    # relâmpagos: brilho externo -> núcleo branco (mais grossos)
    for _ in range(rng.randint(2, 3)):
        x0 = rng.uniform(w * .2, w * .8)
        pts = jagged(rng, x0, -6, x0 + rng.uniform(-50, 50), h * rng.uniform(.55, .8), 8, 22)
        ctx.line(pts, fill=(80, 229, 255, 50), width=15)
        ctx.line(pts, fill=(80, 229, 255, 110), width=8)
        ctx.line(pts, fill=(180, 250, 255, 210), width=3)
        ctx.line(pts, fill=(245, 255, 255, 255), width=1)
        # ramificações
        for _ in range(rng.randint(1, 3)):
            (bx, by) = pts[rng.randint(2, len(pts) - 3)]
            br = jagged(rng, bx, by, bx + rng.uniform(-60, 60), by + rng.uniform(20, 70), 4, 12)
            ctx.line(br, fill=(180, 250, 255, 180), width=2)
        # clarão na água onde cai
        ex, ey = pts[-1]
        for r, a in ((46, 36), (28, 64), (13, 100)):
            ctx.ellipse([ex - r, ey - r * .5, ex + r, ey + r * .5], fill=(140, 240, 255, a))
    # faíscas na superfície
    for _ in range(8):
        x, y = rng.uniform(8, w - 8), rng.uniform(h * .55, h - 12)
        ctx.line([(x, y), (x + rng.randint(-5, 5), y - rng.randint(3, 8))],
                 fill=(200, 250, 255, 220), width=2)


def areia_movedica(ctx, w, h, rng):
    mid = DESERT_MID
    base(ctx, w, h, mid, 1.04, .84)
    blotches(ctx, w, h, rng, [shade(mid, .85), shade(mid, 1.12)], 26, a=22)
    cx, cy = w * .5, h * .52
    # anel externo de sombra
    ctx.ellipse([cx - w * .34, cy - h * .26, cx + w * .34, cy + h * .26],
                fill=(196, 158, 54, 90))
    # espiral concêntrica (areia afundando)
    import math as _m
    for k in range(5):
        r = (5 - k) * 13
        a0 = rng.uniform(0, 6.28)
        pts = []
        for i in range(0, 40, 2):
            ang = a0 + i * .28
            rr = r * (i / 40) + 4
            pts.append((cx + _m.cos(ang) * rr * 1.15, cy + _m.sin(ang) * rr * .75))
        ctx.line(pts, fill=(186, 148, 46, 150), width=4)
        ctx.line(pts, fill=(240, 214, 130, 90), width=1)
    # centro escuro (vórtice)
    ctx.ellipse([cx - 14, cy - 9, cx + 14, cy + 9], fill=(150, 114, 32))
    ctx.ellipse([cx - 7, cy - 5, cx + 7, cy + 5], fill=(96, 70, 22))
    # destroços afundando na borda
    for _ in range(3):
        ang = rng.uniform(0, 6.28)
        bx = cx + _m.cos(ang) * w * .27
        by = cy + _m.sin(ang) * h * .2
        ctx.ellipse([bx - 8, by - 5, bx + 8, by + 6], fill=(120, 92, 40))
        ctx.ellipse([bx - 8, by - 5, bx + 8, by + 1], fill=(160, 128, 58))


def fenda_lava(ctx, w, h, rng):
    base(ctx, w, h, (46, 38, 36), 1.12, .72)
    blotches(ctx, w, h, rng, [(60, 50, 46), (28, 22, 22)], 40, a=40)
    # placas de rocha basalto (mais camadas)
    for _ in range(9):
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        r = rng.uniform(14, 38)
        ctx.ellipse([x - r, y - r * .6, x + r, y + r * .6],
                    fill=(58, 50, 46) if rng.random() < .5 else (34, 28, 26))
    # FENDAS com lava: sombra larga -> brilho -> núcleo quente (mais fissuras)
    for _ in range(rng.randint(3, 4)):
        x0 = rng.uniform(w * .15, w * .85)
        pts = jagged(rng, x0, h * .9, x0 + rng.uniform(-70, 70), h * .1, 9, 26)
        ctx.line(pts, fill=(10, 8, 8), width=15)
        ctx.line(pts, fill=(180, 40, 10, 90), width=9)
        ctx.line(pts, fill=(240, 110, 20), width=5)
        ctx.line(pts, fill=(255, 210, 90), width=2)
        # braços
        for _ in range(rng.randint(1, 3)):
            (bx, by) = pts[rng.randint(2, len(pts) - 3)]
            br = jagged(rng, bx, by, bx + rng.uniform(-55, 55), by + rng.uniform(-45, 45), 4, 10)
            ctx.line(br, fill=(240, 110, 20), width=3)
            ctx.line(br, fill=(255, 210, 90), width=1)
    # calor subindo das fissuras (shimmer)
    for _ in range(6):
        x, y = rng.uniform(10, w - 10), rng.uniform(h * .2, h * .8)
        ctx.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(255, 120, 30, 18))
    # brasas com halo de brilho
    for _ in range(12):
        x, y = rng.uniform(6, w - 6), rng.uniform(6, h - 6)
        ctx.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(150, 50, 15, 60))
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 130, 40, 220))


def fenda_mana(ctx, w, h, rng):
    base(ctx, w, h, (46, 38, 60), 1.1, .7)
    blotches(ctx, w, h, rng, [(62, 48, 84), (30, 24, 42)], 34, a=42)
    # FISSURA de mana: halo violeta -> núcleo claro
    for _ in range(rng.randint(1, 2)):
        x0 = rng.uniform(w * .25, w * .75)
        pts = jagged(rng, x0, h * .92, x0 + rng.uniform(-60, 60), h * .12, 9, 24)
        ctx.line(pts, fill=(120, 60, 190, 60), width=17)
        ctx.line(pts, fill=(150, 80, 220, 120), width=9)
        ctx.line(pts, fill=(220, 170, 255), width=4)
        ctx.line(pts, fill=(245, 230, 255), width=1)
    # CRISTAIS flutuantes: fragmentos facetados
    for _ in range(rng.randint(3, 5)):
        cx = rng.uniform(w * .2, w * .8)
        cy = rng.uniform(h * .25, h * .8)
        s = rng.uniform(8, 16)
        ctx.polygon([(cx, cy - s * 1.4), (cx + s * .7, cy), (cx, cy + s), (cx - s * .7, cy)],
                    fill=(150, 90, 220))
        ctx.polygon([(cx, cy - s * 1.4), (cx + s * .7, cy), (cx, cy + s * .2)],
                    fill=(210, 160, 250))
        ctx.line([(cx, cy - s * 1.4), (cx, cy + s)], fill=(240, 220, 255, 150), width=1)
        # halo
        ctx.ellipse([cx - s * 1.6, cy - s * 1.6, cx + s * 1.6, cy + s * 1.6],
                    outline=(160, 90, 230, 60), width=3)
    # faíscas
    for _ in range(12):
        x, y = rng.uniform(6, w - 6), rng.uniform(6, h - 6)
        ctx.point((x, y), fill=(230, 200, 255))
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(190, 140, 250, 50))


def recife(ctx, w, h, rng):
    mid = lerp(SEA_MID, WATER_MID, .45)
    base(ctx, w, h, mid, 1.06, .78)
    # correntes suaves
    for _ in range(6):
        y0 = rng.uniform(10, h - 10)
        pts = [(i, y0 + math.sin(i / 14 + y0) * 5) for i in range(0, w + 4, 4)]
        ctx.line(pts, fill=shade(mid, 1.25), width=2)
    # manchas de areia no fundo
    for _ in range(4):
        x, y = rng.uniform(10, w - 10), rng.uniform(h * .6, h - 8)
        r = rng.uniform(16, 34)
        ctx.ellipse([x - r, y - r * .35, x + r, y + r * .35], fill=(214, 200, 150, 110))
    # CORAIS ramificados
    for _ in range(rng.randint(2, 3)):
        cx, cy = rng.uniform(w * .2, w * .8), rng.uniform(h * .5, h * .85)
        col = rng.choice([(240, 110, 130), (250, 150, 80), (200, 100, 180)])
        for _ in range(5):  # ramos
            bx, by = cx, cy
            ang = -1.57 + rng.uniform(-.9, .9)
            ln = rng.uniform(26, 52)
            for _ in range(4):  # sub-ramos
                nx = bx + math.cos(ang) * (ln / 4)
                ny = by + math.sin(ang) * (ln / 4)
                ctx.line([(bx, by), (nx, ny)], fill=col, width=5)
                bx, by = nx, ny
                ang += rng.uniform(-.55, .55)
            ctx.ellipse([bx - 3, by - 3, bx + 3, by + 3], fill=shade(col, 1.25))
    # estrela-do-mar
    sx, sy = rng.uniform(30, w - 30), rng.uniform(h * .7, h - 20)
    for i in range(5):
        a = i * 1.2566 - 1.57
        ctx.line([(sx, sy), (sx + math.cos(a) * 13, sy + math.sin(a) * 13)],
                 fill=(250, 140, 60), width=6)
    ctx.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(250, 140, 60))
    # bolhas
    for _ in range(9):
        x, y = rng.uniform(8, w - 8), rng.uniform(8, h * .6)
        r = rng.uniform(2, 5)
        ctx.ellipse([x - r, y - r, x + r, y + r], outline=(230, 250, 255, 160), width=2)


def jazida_dna(ctx, w, h, rng):
    base(ctx, w, h, shade(ROCK_MID, .68), 1.06, .76)
    blotches(ctx, w, h, rng, [(70, 78, 58), (44, 48, 38)], 34, a=40)
    # pedregulhos
    for _ in range(8):
        x, y = rng.uniform(8, w - 8), rng.uniform(h * .6, h - 8)
        r = rng.uniform(5, 12)
        ctx.ellipse([x - r, y - r * .7, x + r, y + r * .7],
                    fill=(84, 92, 68) if rng.random() < .5 else (60, 66, 52))
    # MOLDURA: montinho de cristal
    cx, cy = w * .5, h * .46
    ctx.ellipse([cx - 58, cy + 26, cx + 58, cy + 62], fill=(58, 64, 48))
    ctx.ellipse([cx - 52, cy + 30, cx + 52, cy + 56], fill=(80, 88, 62))
    # HELICE de DNA: duas senoides entrelaçadas + degraus
    helix_h = h * .5
    top = cy - 6
    green = (46, 204, 113)
    for i in range(0, 22):
        t = i / 21
        y = top + helix_h * t
        x1 = cx + math.sin(t * 6.28 * 1.6) * 26
        x2 = cx - math.sin(t * 6.28 * 1.6) * 26
        ctx.line([(x1, y), (x2, y)], fill=shade(green, 1.2), width=3)  # degrau
        ctx.ellipse([x1 - 5, y - 5, x1 + 5, y + 5], fill=green)
        ctx.ellipse([x2 - 5, y - 5, x2 + 5, y + 5], fill=shade(green, .75))
    # halo de brilho
    ctx.ellipse([cx - 44, top - 8, cx + 44, top + helix_h + 8], outline=(120, 255, 160, 70), width=4)
    # esporas flutuantes
    for _ in range(8):
        x, y = rng.uniform(6, w - 6), rng.uniform(6, h - 6)
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(150, 255, 190, 140))


def jazida_ouro(ctx, w, h, rng):
    base(ctx, w, h, shade(ROCK_MID, .74), 1.08, .78)
    blotches(ctx, w, h, rng, [(86, 92, 72), (52, 56, 46)], 30, a=44)
    # rocha facetada
    for _ in range(7):
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        r = rng.uniform(12, 30)
        ctx.polygon([(x, y - r), (x + r * .9, y - r * .2), (x + r * .5, y + r * .8),
                     (x - r * .5, y + r * .8), (x - r * .9, y - r * .2)],
                    fill=(92, 98, 78) if rng.random() < .5 else (58, 62, 50))
    gold = (241, 196, 15)
    # VEIO: arcos dourados
    for _ in range(2):
        x0, y0 = rng.uniform(20, w - 20), rng.uniform(h * .3, h * .7)
        pts = jagged(rng, x0, y0, x0 + rng.uniform(-60, 60), y0 + rng.uniform(30, 60), 5, 12)
        ctx.line(pts, fill=gold, width=6)
        ctx.line(pts, fill=(255, 230, 120), width=2)
    # NUGGETS: pepitas com brilho
    for _ in range(rng.randint(4, 6)):
        x, y = rng.uniform(20, w - 20), rng.uniform(h * .35, h * .8)
        r = rng.uniform(7, 13)
        ctx.ellipse([x - r, y - r * .75, x + r, y + r * .75], fill=gold)
        ctx.ellipse([x - r * .5, y - r * .55, x + r * .2, y - r * .1], fill=(255, 235, 140))
    # SPARKLES: glint em cruz
    for _ in range(5):
        x, y = rng.uniform(14, w - 14), rng.uniform(14, h - 14)
        s = rng.uniform(8, 14)
        ctx.line([(x - s, y), (x + s, y)], fill=(255, 250, 200, 230), width=2)
        ctx.line([(x, y - s), (x, y + s)], fill=(255, 250, 200, 230), width=2)


def mercado_negro(ctx, w, h, rng):
    base(ctx, w, h, (56, 50, 46), 1.06, .74)
    blotches(ctx, w, h, rng, [(70, 62, 54), (40, 36, 34)], 26, a=46)
    # soleira de pedra
    for _ in range(10):
        x, y = rng.uniform(8, w - 8), rng.uniform(10, h - 8)
        r = rng.uniform(6, 14)
        ctx.ellipse([x - r, y - r * .55, x + r, y + r * .55], fill=(74, 68, 60))
    # TENDA escura (mercado negro)
    cx = w * .5
    ty = h * .3
    # mastro
    ctx.line([(cx, ty), (cx, h * .88)], fill=(46, 36, 28), width=6)
    # toldo em panos escuros com listras
    for i, (dx0, dx1) in enumerate([(-.62, -.3), (-.32, .02), (.02, .34), (.36, .62)]):
        col = (34, 30, 38) if i % 2 == 0 else (44, 40, 48)
        ctx.polygon([(cx + dx0 * w, ty + abs(dx0) * 26),
                     (cx + dx1 * w, ty + abs(dx1) * 26),
                     (cx + dx1 * w, ty + abs(dx1) * 26 + 34),
                     (cx + dx0 * w, ty + abs(dx0) * 26 + 34)], fill=col)
    # caixotes
    for bx in (cx - 52, cx + 26):
        by = h * .68
        ctx.rectangle([bx, by, bx + 30, by + 24], fill=(76, 58, 40), outline=(48, 36, 24), width=2)
        ctx.line([(bx, by + 12), (bx + 30, by + 12)], fill=(58, 44, 30), width=2)
    # LANTERNA com brilho quente
    lx, ly = cx - 64, ty + 40
    for r, a in ((30, 36), (18, 70), (9, 120)):
        ctx.ellipse([lx - r, ly - r, lx + r, ly + r], fill=(255, 190, 90, a))
    ctx.rectangle([lx - 4, ly - 7, lx + 4, ly + 7], fill=(70, 56, 30))
    ctx.ellipse([lx - 3, ly - 3, lx + 3, ly + 3], fill=(255, 230, 150))
    # moedas perdidas
    for _ in range(5):
        x, y = rng.uniform(14, w - 14), rng.uniform(h * .72, h - 12)
        ctx.ellipse([x - 4, y - 3, x + 4, y + 3], fill=(210, 170, 60))


# ---------- registro: nome, arquivo, colunas, pintor ----------
SPECS = [
    ('Água Eletrizada', 'agua_eletrificada.png', 6, agua_eletrificada),
    ('Areia Movediça', 'areia_movedica.png', 6, areia_movedica),
    ('Fenda de Lava', 'fenda_lava.png', 6, fenda_lava),
    ('Fenda de Mana', 'fenda_mana.png', 6, fenda_mana),
    ('Recife', 'recife.png', 6, recife),
    ('Jazida de DNA', 'jazida_dna.png', 6, jazida_dna),
    ('Jazida de Ouro', 'jazida_ouro.png', 3, jazida_ouro),
    ('Mercado Negro', 'mercado_negro.png', 5, mercado_negro),
]


def validate(path, cols):
    img = Image.open(path).convert('RGB')
    cw, ch = img.width // cols, img.height
    probs = []
    for col in range(cols):
        cell = img.crop((col * cw, 0, col * cw + cw, ch))
        for qx in range(2):
            for qy in range(2):
                q = cell.crop((qx * cw // 2, qy * ch // 2,
                               (qx + 1) * cw // 2, (qy + 1) * ch // 2))
                vals = [sum(q.getpixel((x, y))) / 3
                        for y in range(0, q.height, 6) for x in range(0, q.width, 6)]
                if statistics.pstdev(vals) < 1.5:
                    probs.append(f'c{col} q{qx}{qy}: QUADRANTE VAZIO')
                if sum(vals) / len(vals) < 22:
                    probs.append(f'c{col} q{qx}{qy}: PRETO')
        edges = [cell.getpixel((x, 0)) for x in range(0, cw, 8)] + \
                [cell.getpixel((x, ch - 1)) for x in range(0, cw, 8)]
        if sum(1 for p in edges if sum(p) / 3 < 22) > len(edges) * .3:
            probs.append(f'c{col}: BORDA PRETA')
    if probs:
        for p in probs[:10]:
            print('  [ERRO]', p)
        raise SystemExit(f'{os.path.basename(path)}: validacao falhou ({len(probs)})')


def main():
    os.makedirs(TILES, exist_ok=True)
    # SELETIVO: `python generate_special_tiles.py agua_eletrificada fenda_lava`
    # gera apenas os nomeados (não sobrescreve artes trocadas na mão!)
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    prev_cells = []
    for nome, fname, cols, painter in SPECS:
        if only and fname not in only and nome not in only:
            continue
        sheet = Image.new('RGB', (CW * cols, CH), (20, 20, 24))
        for col in range(cols):
            p = Painter(CW * SS, CH * SS)
            painter(p, CW * SS, CH * SS, rng_for(nome, col))
            sheet.paste(p._image.resize((CW, CH), Image.LANCZOS), (col * CW, 0))
            prev_cells.append((nome, p._image.resize((CW // 2, CH // 2), Image.LANCZOS)))
        out = os.path.join(TILES, fname)
        sheet.save(out)
        validate(out, cols)
        print(f'[OK] {nome} -> {fname} ({CW * cols}x{CH}, {cols} variacoes)')
    # preview combinado (2 linhas x 4)
    pw, phh = CW // 2, CH // 2
    prev = Image.new('RGB', (pw * 4, phh * 2), (20, 20, 24))
    for i, (nome, cell) in enumerate(prev_cells):
        x = (i % 4) * pw
        y = (i // 4) * phh
        prev.paste(cell, (x, y))
    prev.save(os.path.join(ROOT, 'test', 'artifacts', 'specials_preview.png'))
    print('[OK] preview -> test/artifacts/specials_preview.png')


if __name__ == '__main__':
    main()