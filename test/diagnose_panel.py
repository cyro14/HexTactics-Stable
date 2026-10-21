# Diagnóstico: o que está pintado na região do painel lateral (battle.png)?
from PIL import Image
import sys

img = Image.open(sys.argv[1] if len(sys.argv) > 1 else "test/artifacts/battle.png").convert("RGB")
w, h = img.size
print(f"Imagem: {w}x{h}")

def count(x0, x1, y0, y1, cond, step=1):
    return sum(1 for y in range(y0, y1, step) for x in range(x0, x1, step) if cond(*img.getpixel((x, y))))

# Região do painel: x 1000-1280, y 58-800
px0, px1, py0, py1 = 1000, w, 58, h

# 1) O fundo do painel está pintado? (amostras espalhadas)
samples = [(1030, 200), (1150, 300), (1250, 400), (1100, 600), (1240, 700), (1150, 100)]
print("\nAmostras de cor na região do painel (x,y): RGB")
for (sx, sy) in samples:
    print(f"  ({sx},{sy}): {img.getpixel((sx, sy))}")

# 2) Pixels dourados na região do painel (o que o verify.py procura)
gold = count(px0, px1, py0, py1, lambda r, g, b: r > 170 and g > 120 and b < 100, 2)
print(f"\nPixels dourados (r>170,g>120,b<100) no painel x{px0}-{px1}: {gold}")

# 3) Pixels dourados com thresholds alternativos
g2 = count(px0, px1, py0, py1, lambda r, g, b: r > 200 and g > 150 and b < 130, 2)
print(f"Pixels dourado-claro (r>200,g>150,b<130) no painel: {g2}")
g3 = count(px0, px1, py0, py1, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
print(f"Pixels dourado-largo (r>150,g>100,b<90) no painel: {g3}")

# 4) Onde estão os dourados? (bounding box passo 2)
xs, ys = [], []
for y in range(py0, py1, 2):
    for x in range(px0, px1, 2):
        r, g, b = img.getpixel((x, y))
        if r > 150 and g > 100 and b < 90:
            xs.append(x); ys.append(y)
if xs:
    print(f"\nDourado-largo no painel: {len(xs)} px, bbox x {min(xs)}-{max(xs)}, y {min(ys)}-{max(ys)}")

# 5) Action bar bottom-left: dourado (ícones dos utilitários + slots de magia)
ab = count(0, 520, h - 90, h, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
print(f"\nPixels dourados na action bar (x<520, y>{h-90}): {ab}")

# 6) Crônica topo-direita (right:292px width:320px -> x 668-988, top: 66px)
lg = count(660, 1000, 60, 260, lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
print(f"Pixels dourados na crônica topo-direita (x 660-1000, y 60-260): {lg}")

# 7) média de cor de faixas horizontais do painel
print("\nFaixas horizontais do painel (cor média x 1000-1280):")
for y in range(60, h, 80):
    rs = gs = bs = n = 0
    for x in range(1000, w, 4):
        r, g, b = img.getpixel((x, y))
        rs += r; gs += g; bs += b; n += 1
    print(f"  y={y}: RGB médio ({rs//n}, {gs//n}, {bs//n})")