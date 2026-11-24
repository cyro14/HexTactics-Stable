import os, re, glob, shutil
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_BASE = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

# We want all files in Novos 8bits to be converted to RGBA PNG with transparent background if needed
MARKER = (255, 0, 255)
THRESH = 34
SOFT = 56

def corner_bg(img):
    px = img.load()
    w, h = img.size
    c0 = px[0, 0]
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    for c in corners:
        if max(abs(c[i] - c0[i]) for i in range(3)) > 15:
            return None
    return c0[:3]

def has_alpha(img):
    if img.mode != 'RGBA':
        return False
    a = img.getchannel('A')
    mn, mx = a.getextrema()
    return mn < 250

def strip_img(path):
    img = Image.open(path).convert('RGBA')
    if has_alpha(img):
        return ('ja-alfa', path)
    
    bg = corner_bg(img)
    if bg is None:
        # Check if corner is near white or gray
        c0 = img.load()[0, 0][:3]
        if min(c0) > 180 or (max(c0) - min(c0) < 15):
            bg = c0
        else:
            return ('fundo-invalido', path)

    w, h = img.size
    work = img.convert('RGB').copy()
    d = ImageDraw.Draw(work)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w//2, 0), (0, h//2), (w-1, h//2), (w//2, h-1)]:
        try:
            ImageDraw.floodfill(work, seed, MARKER, thresh=THRESH)
        except Exception:
            pass
    wp = work.load()
    mask = [[wp[x, y] == MARKER for x in range(w)] for y in range(h)]
    removed = sum(row.count(True) for row in mask)
    if removed < w * h * 0.01:
        return ('sem-fundo-detectado', path)

    px = img.load()
    shell = set()
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                continue
            near = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny][nx]:
                        near = True
                        break
                if near:
                    break
            if near:
                shell.add((x, y))

    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                px[x, y] = (0, 0, 0, 0)
    for (x, y) in shell:
        r, g, b = px[x, y][:3]
        dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        if dist < SOFT:
            a = max(0, min(255, int(255 * (dist - THRESH * 0.5) / (SOFT - THRESH * 0.5))))
            px[x, y] = (r, g, b, a)

    base, ext = os.path.splitext(path)
    out_path = base + '.png'
    img.save(out_path, format='PNG')
    if ext.lower() in ('.jpeg', '.jpg'):
        os.remove(path)
    return ('ok', out_path)

# Run over all files in Novos 8bits
count = 0
for root, dirs, files in os.walk(SRC_BASE):
    for f in files:
        if f.lower().endswith(('.png', '.jpg', '.jpeg')):
            p = os.path.join(root, f)
            st, outp = strip_img(p)
            if st == 'ok':
                count += 1
                print(f"[CLEANED] {os.path.relpath(outp, ROOT)}")
print(f"Total stripped: {count}")
