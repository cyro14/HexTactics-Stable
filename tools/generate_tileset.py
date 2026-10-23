# ==========================================
# GERADOR PROCEDURAL DE TILESET — Biomancer Tactics
# Substitui o tileset feito por IA (impreciso): cada célula é um QUADRADO
# CHEIO de textura com proporção exata do bbox do hexágono pointy-top
# (√3 : 2 = 130x150) — quando o engine mapeia célula→bbox, a distorção é
# ZERO e as arestas entre hexes casam matematicamente.
#
# Layout (contrato do engine, 6 variações por linha):
#   row 0  PLAINS | 1 FOREST | 2 MOUNTAIN | 3 WATER | 4 SEA | 5 DESERT
#   row 6  SNOW   | 7 SWAMP  | 8 VILLAGE  | 9 CASTLE | 10 SAVANNA
#   row 11 BURNING_FOREST | row 12 ASHES (linha nova)
#
# Uso: python tools/generate_tileset.py
# Determinístico: seeds fixas por (linha, coluna) => arte versionável.
# ==========================================
import os
import math
import random
import statistics
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'tiles', 'tileset.png')

COLS, ROWS = 6, 13
CW, CH = 130, 150          # célula final (aspecto √3/2 = bbox do hex)
SS = 2                     # supersampling: pinta em 260x300, reduz LANCZOS


# ---------- utilidades ----------
def shade(c, f):
    """multiplica brilho (f>1 clareia) com clamp"""
    return tuple(max(0, min(255, int(v * f))) for v in c)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def cell_rng(row, col):
    return random.Random(1000 * row + col + 7)


def base(ctx, w, h, mid, top_f=1.12, bot_f=0.82):
    """gradiente vertical de iluminação (luz de cima)"""
    for y in range(h):
        t = y / max(1, h - 1)
        c = lerp(shade(mid, top_f), shade(mid, bot_f), t)
        ctx.line([(0, y), (w, y)], fill=c)


def blotches(ctx, w, h, rng, colors, n=70, a=16, rmin=10, rmax=42):
    """manchas suaves de textura (elipses com alpha baixinho)"""
    ov = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for _ in range(n):
        col = rng.choice(colors)
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        rx, ry = rng.uniform(rmin, rmax), rng.uniform(rmin, rmax)
        od.ellipse([x - rx, y - ry, x + rx, y + ry], fill=col + (a,))
    ctx._image.paste(Image.alpha_composite(ctx._image.convert('RGBA'), ov).convert('RGB'), (0, 0))


class Painter:
    """wrapper: desenha em PIL e guarda referência pra overlays"""
    def __init__(self, w, h):
        self._image = Image.new('RGB', (w, h))
        self._draw = ImageDraw.Draw(self._image, 'RGBA')

    def __getattr__(self, name):
        return getattr(self._draw, name)


# ---------- pincéis de terreno (recebem ctx Painter, rng) ----------
def plains(ctx, w, h, rng):
    mid = (91, 140, 66)
    base(ctx, w, h, mid)
    blotches(ctx, w, h, rng, [shade(mid, .82), shade(mid, 1.15)], 60)
    # tufos de grama
    for _ in range(150):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ln = rng.uniform(4, 10)
        dx = rng.uniform(-2, 2)
        col = shade(mid, rng.uniform(.75, 1.3))
        ctx.line([(x, y), (x + dx, y - ln)], fill=col, width=2)
    # florzinhas espalhadas
    for _ in range(6):
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        col = (238, 232, 140) if rng.random() < .6 else (245, 245, 245)
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col)
        ctx.line([(x, y + 2), (x, y + 6)], fill=shade(mid, .7), width=1)


def forest(ctx, w, h, rng):
    mid = (30, 77, 43)
    base(ctx, w, h, mid, 1.05, .7)
    for _ in range(rng.randint(4, 6)):
        cx, cy = rng.uniform(30, w - 30), rng.uniform(24, h - 30)
        R = rng.uniform(26, 42)
        blob = []
        for _ in range(5):
            bx = cx + rng.uniform(-R * .6, R * .6)
            by = cy + rng.uniform(-R * .5, R * .5)
            br = rng.uniform(R * .5, R)
            blob.append((bx, by, br))
        for bx, by, br in blob:  # sombra embaixo
            ctx.ellipse([bx - br, by - br * .2, bx + br, by + br * .8], fill=shade(mid, .55))
        for bx, by, br in blob:  # copa
            ctx.ellipse([bx - br, by - br, bx + br, by + br], fill=(24, 60, 36))
        for bx, by, br in blob:  # luz NO
            ctx.arc([bx - br * .9, by - br * .9, bx + br * .2, by - br * .2],
                    180, 300, fill=(52, 104, 66), width=3)


def mountain(ctx, w, h, rng):
    """montanha bonita: picos em camadas (haze atrás), face iluminada,
    face sombria, neve no cume, cume estreito + cascalho na base"""
    mid = (98, 94, 92)
    base(ctx, w, h, shade(mid, .62))

    # --- picos distantes (névoa) ---
    for _ in range(2):
        cx = rng.uniform(28, w - 28)
        peak_y = rng.uniform(52, 92)
        base_y = h * rng.uniform(.62, .74)
        halfw = rng.uniform(58, 92)
        haze = lerp((120, 118, 126), (88, 86, 94), rng.uniform(.3, .6))
        ctx.polygon([(cx, peak_y), (cx - halfw, base_y), (cx + halfw, base_y)], fill=haze)

    # --- picos principais ---
    for _ in range(rng.randint(2, 3)):
        cx = rng.uniform(w * .22, w * .78)
        peak_y = rng.uniform(24, 58)
        base_y = h * rng.uniform(.82, .94)
        halfw = rng.uniform(52, 82)
        # silhueta
        ctx.polygon([(cx, peak_y), (cx - halfw, base_y), (cx + halfw, base_y)],
                    fill=(84, 80, 86))
        # face ILUMINADA (luz de cima-esquerda): triângulo pico->base-esq->cume
        ridge_dx = rng.uniform(-halfw * .25, halfw * .1)
        lit = (150, 145, 148)
        ctx.polygon([(cx, peak_y),
                     (cx - halfw * .96, base_y),
                     (cx + ridge_dx, base_y)], fill=lit)
        # facetas de luz (2-3 sub-faces com brilho diferente)
        for k in range(rng.randint(2, 3)):
            t = rng.uniform(.25, .7)
            fx0 = cx - halfw * .96 * t
            fx1 = cx - halfw * .96 * (t + .2)
            ctx.polygon([(cx, peak_y),
                         (fx0, base_y),
                         (fx1, base_y)],
                        fill=shade(lit, rng.uniform(.82, 1.06)))
        # face sombria com facetas
        dark = (58, 54, 62)
        ctx.polygon([(cx, peak_y),
                     (cx + ridge_dx, base_y),
                     (cx + halfw * .96, base_y)], fill=dark)
        for k in range(2):
            t = rng.uniform(.3, .7)
            fx0 = cx + halfw * .96 * t
            fx1 = cx + halfw * .96 * (t + .2)
            ctx.polygon([(cx, peak_y), (fx0, base_y), (fx1, base_y)],
                        fill=shade(dark, rng.uniform(.85, 1.15)))
        # NEVE no cume (topo ~26% com recorte irregular)
        cap_h = (base_y - peak_y) * rng.uniform(.2, .3)
        snow = (236, 242, 250)
        pts = [(cx, peak_y)]
        n = 5
        for i in range(1, n):
            t = i / n
            sx = cx - halfw * t
            sy = peak_y + cap_h * (i / n) * (1 + rng.uniform(-.25, .25))
            pts.append((sx, sy))
        pts.append((cx, peak_y + cap_h))
        for i in range(1, n):
            t = i / n
            sx = cx + halfw * t
            sy = peak_y + cap_h * (i / n) * (1 + rng.uniform(-.25, .25))
            pts.append((sx, sy))
        ctx.polygon(pts, fill=snow)
        # sombra azulada na base da neve
        ctx.polygon([(cx - halfw * .45, peak_y + cap_h * .9),
                     (cx + halfw * .45, peak_y + cap_h * .9),
                     (cx + halfw * .2, peak_y + cap_h),
                     (cx - halfw * .2, peak_y + cap_h)],
                    fill=(198, 210, 228))
        # linha de crista
        ctx.line([(cx, peak_y), (cx + ridge_dx, base_y)], fill=(60, 56, 64), width=2)

    # --- cascalho/destroços na base ---
    for _ in range(14):
        x, y = rng.uniform(6, w - 6), rng.uniform(h * .68, h - 8)
        r = rng.uniform(3, 8)
        ctx.ellipse([x - r, y - r * .7, x + r, y + r * .7],
                    fill=shade((76, 72, 78), rng.uniform(.8, 1.25)))
    blotches(ctx, w, h, rng, [(60, 58, 64), (116, 112, 120)], 36)


def water(ctx, w, h, rng):
    mid = (52, 152, 219)
    base(ctx, w, h, mid, 1.05, .8)
    ov = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for _ in range(11):
        y0 = rng.uniform(12, h - 12)
        x0 = rng.uniform(-10, w * .5)
        amp = rng.uniform(3, 7)
        col = (110, 195, 240, rng.randint(60, 110))
        pts = [(x0 + i * 4, y0 + math.sin((x0 + i) / 9 + y0) * amp) for i in range(0, int(w * .8), 4)]
        od.line(pts, fill=col, width=3)
    ctx._image.paste(Image.alpha_composite(ctx._image.convert('RGBA'), ov).convert('RGB'), (0, 0))
    for _ in range(9):  # brilhos
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        ctx.line([(x, y), (x + rng.randint(4, 9), y)], fill=(215, 240, 255), width=2)


def sea(ctx, w, h, rng):
    mid = (41, 128, 185)
    base(ctx, w, h, mid, 1.02, .72)
    for _ in range(8):
        y0 = rng.uniform(14, h - 14)
        amp = rng.uniform(5, 9)
        pts = [(i, y0 + math.sin(i / 11 + y0 * .2) * amp) for i in range(0, w + 4, 4)]
        ctx.line(pts, fill=(70, 155, 215), width=4)
    for _ in range(6):  # espuma
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        ctx.ellipse([x - 4, y - 2, x + 4, y + 2], fill=(205, 230, 250))
        ctx.ellipse([x - 2, y - 1, x + 2, y + 1], fill=(240, 250, 255))


def desert(ctx, w, h, rng):
    mid = (230, 200, 110)
    base(ctx, w, h, mid, 1.06, .85)
    for _ in range(7):  # marcas de dunas
        y0 = rng.uniform(16, h - 16)
        col = (208, 172, 88)
        pts = [(i, y0 + math.sin(i / 16 + y0) * 6) for i in range(0, w + 4, 4)]
        ctx.line(pts, fill=col, width=3)
        pts2 = [(i, y0 + 2 + math.sin(i / 16 + y0) * 6) for i in range(0, w + 4, 4)]
        ctx.line(pts2, fill=(240, 218, 140), width=2)
    for _ in range(5):  # pedrinhas
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(178, 148, 72))


def snow(ctx, w, h, rng):
    mid = (204, 230, 244)
    base(ctx, w, h, mid, 1.02, .9)
    blotches(ctx, w, h, rng, [(180, 206, 228), (255, 255, 255)], 26, a=30)
    for _ in range(8):  # brilhos
        x, y = rng.uniform(8, w - 8), rng.uniform(8, h - 8)
        ctx.line([(x, y), (x + 3, y)], fill=(255, 255, 255), width=2)
        ctx.line([(x + 4, y + 1), (x + 5, y + 1)], fill=(190, 214, 235), width=1)


def swamp(ctx, w, h, rng):
    mid = (59, 83, 35)
    base(ctx, w, h, mid, 1.05, .7)
    for _ in range(3):  # poças turvas com brilho
        x, y = rng.uniform(20, w - 20), rng.uniform(20, h - 20)
        rx, ry = rng.uniform(18, 34), rng.uniform(10, 20)
        ctx.ellipse([x - rx, y - ry, x + rx, y + ry], fill=(48, 66, 32))
        ctx.ellipse([x - rx * .8, y - ry * .8, x + rx * .8, y + ry * .8], fill=(74, 98, 52))
        ctx.arc([x - rx * .6, y - ry * .6, x + rx * .2, y + ry * .2], 200, 300,
                fill=(140, 170, 100), width=3)
    for _ in range(14):  # taboas/juncos
        x = rng.uniform(8, w - 8)
        y0 = rng.uniform(h * .4, h - 6)
        ln = rng.uniform(16, 34)
        ctx.line([(x, y0), (x + rng.uniform(-3, 3), y0 - ln)], fill=(38, 58, 24), width=3)
        ctx.ellipse([x - 2, y0 - ln - 5, x + 2, y0 - ln], fill=(96, 112, 52))


def village(ctx, w, h, rng):
    mid = (100, 130, 70)
    base(ctx, w, h, mid, 1.05, .78)
    # caminho de terra
    ctx.ellipse([w * .1, h * .55, w * .9, h * .95], fill=(160, 130, 82))
    ctx.ellipse([w * .2, h * .6, w * .8, h * .9], fill=(176, 146, 96))
    for _ in range(2):  # casinhas
        x = rng.uniform(16, w - 60)
        y = rng.uniform(28, h * .5)
        bw, bh = rng.randint(34, 46), rng.randint(24, 32)
        ctx.rectangle([x, y, x + bw, y + bh], fill=(188, 150, 102), outline=(120, 88, 56), width=2)
        ctx.polygon([(x - 4, y), (x + bw + 4, y), (x + bw * .5, y - 16)], fill=(150, 62, 50))
        ctx.line([(x - 4, y), (x + bw + 4, y)], fill=(196, 84, 66), width=2)
        ctx.rectangle([x + bw * .4, y + bh * .5, x + bw * .4 + 8, y + bh], fill=(94, 64, 42))
        ctx.rectangle([x + 6, y + 6, x + 12, y + 12], fill=(240, 220, 140))


def castle(ctx, w, h, rng):
    mid = (61, 68, 74)
    base(ctx, w, h, mid, 1.05, .78)
    # muralha central
    x0, y0 = w * .12, h * .3
    bw, bh = w * .76, h * .4
    ctx.rectangle([x0, y0, x0 + bw, y0 + bh], fill=(96, 102, 110), outline=(52, 58, 66), width=2)
    # ameias
    step = bw / 7
    for i in range(7):
        if i % 2 == 0:
            ctx.rectangle([x0 + i * step, y0 - 10, x0 + (i + 1) * step, y0], fill=(96, 102, 110))
    # torre
    ctx.rectangle([x0 + bw * .42, y0 - 34, x0 + bw * .58, y0], fill=(84, 90, 98))
    for i in range(3):
        ctx.rectangle([x0 + bw * .42 + i * (bw * .16 / 3), y0 - 44, x0 + bw * .42 + (i + .8) * (bw * .16 / 3), y0 - 34],
                      fill=(84, 90, 98))
    # portão
    ctx.rectangle([x0 + bw * .42, y0 + bh * .55, x0 + bw * .58, y0 + bh], fill=(40, 32, 28))
    ctx.arc([x0 + bw * .42, y0 + bh * .4, x0 + bw * .58, y0 + bh * .65], 180, 360, fill=(40, 32, 28), width=4)
    blotches(ctx, w, h, rng, [(70, 76, 84), (120, 126, 134)], 30)


def savanna(ctx, w, h, rng):
    mid = (212, 163, 115)
    base(ctx, w, h, mid, 1.04, .84)
    blotches(ctx, w, h, rng, [(190, 140, 90), (228, 190, 140)], 30, a=24)
    for _ in range(24):  # tufos secos
        x, y = rng.uniform(6, w - 6), rng.uniform(10, h - 6)
        for k in range(-2, 3):
            ln = rng.uniform(6, 14)
            ctx.line([(x, y), (x + k * 3, y - ln)], fill=(172, 132, 82) if k % 2 else (196, 160, 108), width=2)
    for _ in range(3):  # rachaduras da seca
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        pts = [(x, y)]
        for i in range(4):
            x += rng.uniform(-14, 14)
            y += rng.uniform(4, 12)
            pts.append((x, y))
        ctx.line(pts, fill=(150, 110, 70), width=1)


def burning(ctx, w, h, rng):
    mid = (45, 32, 28)
    base(ctx, w, h, mid, 1.1, .75)
    for _ in range(4):  # troncos carbonizados
        x = rng.uniform(10, w - 10)
        y0 = rng.uniform(h * .5, h * .85)
        ctx.line([(x, y0), (x + rng.uniform(-6, 6), y0 - rng.uniform(20, 40))], fill=(24, 16, 14), width=6)
    for _ in range(4):  # chamas: camadas laranja->amarelo->claro
        x, rng_y = rng.uniform(16, w - 16), rng.uniform(h * .35, h * .8)
        fh = rng.uniform(28, 52)
        for k, col in enumerate([(214, 74, 20), (250, 140, 30), (255, 220, 100)]):
            sh = fh * (1 - k * .28)
            ctx.polygon([(x - (14 - k * 4), rng_y), (x + (14 - k * 4), rng_y),
                         (x + rng.uniform(-5, 5), rng_y - sh)], fill=col)
    for _ in range(12):  # brasas
        x, y = rng.uniform(4, w - 4), rng.uniform(4, h - 4)
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 120, 40))


def ashes(ctx, w, h, rng):
    mid = (68, 68, 68)
    base(ctx, w, h, mid, 1.06, .8)
    blotches(ctx, w, h, rng, [(92, 92, 92), (50, 50, 52)], 40, a=26)
    for _ in range(20):  # veios de cinza
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ctx.line([(x, y), (x + rng.uniform(-12, 12), y - rng.uniform(6, 16))],
                 fill=(108, 108, 108), width=2)
    for _ in range(5):  # brasas morrendo
        x, y = rng.uniform(10, w - 10), rng.uniform(10, h - 10)
        ctx.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(180, 80, 30))
        ctx.ellipse([x - 3, y - 3, x + 3, y + 3], outline=(120, 60, 30))


# linha -> pincel
PAINTERS = [plains, forest, mountain, water, sea, desert,
            snow, swamp, village, castle, savanna, burning, ashes]

NOMES = ['PLAINS', 'FOREST', 'MOUNTAIN', 'WATER', 'SEA', 'DESERT',
         'SNOW', 'SWAMP', 'VILLAGE', 'CASTLE', 'SAVANNA', 'BURNING', 'ASHES']


def validate(path):
    """
    Validação ANTI-'um quarto': cada célula precisa de textura nos 4
    QUADRANTES (std-dev e brilho) e bordas pintadas (sem faixas pretas
    = sem frestas entre hexes).
    """
    img = Image.open(path).convert('RGB')
    cw, ch = img.width // COLS, img.height // ROWS
    problemas = []
    for row in range(ROWS):
        for col in range(COLS):
            cell = img.crop((col * cw, row * ch, col * cw + cw, row * ch + ch))
            for qx in range(2):
                for qy in range(2):
                    q = cell.crop((qx * cw // 2, qy * ch // 2,
                                   (qx + 1) * cw // 2, (qy + 1) * ch // 2))
                    vals = [sum(q.getpixel((x, y))) / 3
                            for y in range(0, q.height, 4) for x in range(0, q.width, 4)]
                    mean = sum(vals) / len(vals)
                    std = statistics.pstdev(vals)
                    if std < 1.5:
                        problemas.append(f'{NOMES[row]} c{col} q{qx}{qy}: QUADRANTE VAZIO (std {std:.1f})')
                    if mean < 22:
                        problemas.append(f'{NOMES[row]} c{col} q{qx}{qy}: PRETO DEMAIS (media {mean:.0f})')
            edges = [cell.getpixel((x, 0)) for x in range(0, cw, 8)] + \
                    [cell.getpixel((x, ch - 1)) for x in range(0, cw, 8)] + \
                    [cell.getpixel((0, y)) for y in range(0, ch, 8)] + \
                    [cell.getpixel((cw - 1, y)) for y in range(0, ch, 8)]
            dark_edges = sum(1 for p in edges if sum(p) / 3 < 22)
            if dark_edges > len(edges) * 0.25:
                problemas.append(f'{NOMES[row]} c{col}: BORDA PRETA ({dark_edges}/{len(edges)} escuros)')
    if problemas:
        for p in problemas[:20]:
            print('  [ERRO]', p)
        raise SystemExit(f'validacao falhou: {len(problemas)} problemas')
    print(f'[OK] validacao: {ROWS * COLS} celulas com textura nos 4 quadrantes e bordas pintadas')


def main():
    # sheet final em escala 1x: cada célula é pintada em SS e reduzida com
    # LANCZOS, depois colada na posição 1x CORRETA (o bug do "um quarto"
    # era colar célula 1x em coordenadas SS)
    sheet = Image.new('RGB', (CW * COLS, CH * ROWS), (20, 20, 24))
    for row, painter in enumerate(PAINTERS):
        for col in range(COLS):
            p = Painter(CW * SS, CH * SS)
            painter(p, CW * SS, CH * SS, cell_rng(row, col))
            cell = p._image.resize((CW, CH), Image.LANCZOS)
            sheet.paste(cell, (col * CW, row * CH))
    sheet.save(OUT)
    print(f'[OK] tileset gerado: {OUT} ({CW * COLS}x{CH * ROWS}, {COLS}x{ROWS} celulas, aspecto {CW/CH:.4f} ~ sqrt(3)/2)')
    validate(OUT)


if __name__ == '__main__':
    main()