# Analisa os sprites novos em img/sprites/ajustar: agrupa por prompt-base,
# mede dimensoes/fundo/cores dominantes para caracterizar cada criatura.
import os
import re
from PIL import Image
from collections import defaultdict, Counter

SRC = 'img/sprites/ajustar'
groups = defaultdict(list)
for f in os.listdir(SRC):
    if not f.endswith('.png'):
        continue
    base = re.sub(r'~\d+$', '', f)
    groups[base].append(f)


def dom_colors(img, n=4):
    c = Counter()
    px = img.load()
    for y in range(0, img.height, 5):
        for x in range(0, img.width, 5):
            p = px[x, y]
            if len(p) == 4 and p[3] < 100:
                continue
            c[(p[0] // 40 * 40, p[1] // 40 * 40, p[2] // 40 * 40)] += 1
    return [k for k, v in c.most_common(n)]


for base, files in sorted(groups.items()):
    best = max(files, key=lambda f: os.path.getsize(os.path.join(SRC, f)))
    img = Image.open(os.path.join(SRC, best)).convert('RGBA')
    w, h = img.size
    corners = [img.getpixel((0, 0)), img.getpixel((w - 1, 0)),
               img.getpixel((0, h - 1)), img.getpixel((w - 1, h - 1))]
    alpha_bg = all(c[3] < 100 for c in corners)
    doms = dom_colors(img)
    bg = 'ALFA' if alpha_bg else str(corners[0][:3])
    print(f'{base[:20]:22} x{len(files)} | {w}x{h} | bg {bg:16} | cores {doms}')