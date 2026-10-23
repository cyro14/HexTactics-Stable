# ==========================================
# REMOVEDOR DE FUNDO PARA SPRITES — Biomancer Tactics
# Por que as IAs falharam: elas removem "qual cinza parecido com fundo",
# comendo também os tons escuros INTERNOS dos sprites. Este script usa
# FLOOD-FILL a partir das bordas: só remove o cinza CONECTADO à margem;
# escuridão interna (contornos, sombras) fica intacta. Bordas recebem
# alfa proporcional + defringe (descontaminação da cor do fundo).
#
# Uso:  python tools/strip_backgrounds.py          (processa tudo)
#       python tools/strip_backgrounds.py --dry    (só relata)
# Requisito: Pillow. Originais recuperáveis via git (git checkout -- <arquivo>).
# ==========================================
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# pastas do jogo com sprites/retratos de personagens e criaturas
TARGET_DIRS = ['img/units', 'img/boss', 'img/sprites', 'img/lideres']
MARKER = (255, 0, 255)      # cor impossível: marca a região de fundo
THRESH = 34                 # tolerância de canal do flood-fill
SOFT = 56                   # distância euclidiana p/ suavizar a borda

# NUNCA processar: folhas de sprite (sheets), utilitários e lixo de upload
EXCLUDE = {
    'units1.png', 'units2.png', 'units3.png',       # sheets de unidades
    'boss.png', 'boss2.png', 'boss3.png', 'boss4.png',
    'leaders.png',                                    # sheet de líderes
    'icons.png', 'icones.png', 'tileset.png', 'spells.jpeg', 'sol.png', 'water.png',
    'reino.jpeg',
    '1-removebg-preview (1).png',
    'WhatsApp_Image_2026-06-02_at_08.58.09-removebg-preview.png',
}


def corner_bg(img):
    """cor de fundo = pixel (0,0); valida contra os outros cantos"""
    px = img.load()
    w, h = img.size
    c0 = px[0, 0]
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    # fundo precisa ser consistente nos 4 cantos
    for c in corners:
        if max(abs(c[i] - c0[i]) for i in range(3)) > 10:
            return None
    return c0[:3]


def has_alpha(img):
    a = img.getchannel('A')
    mn, mx = a.getextrema()
    return mn < 250


def strip(path):
    fname = os.path.basename(path)
    img = Image.open(path).convert('RGBA')
    if has_alpha(img):
        return ('ja-alfa', 0, fname)

    bg = corner_bg(img)
    if bg is None:
        return ('fundo-invalido', 0, fname)

    w, h = img.size
    # máscara de fundo via flood-fill (4 sementes) sobre uma cópia RGB
    work = img.convert('RGB').copy()
    d = ImageDraw.Draw(work)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(work, seed, MARKER, thresh=THRESH)
        except Exception:
            pass
    wp = work.load()
    mask = [[wp[x, y] == MARKER for x in range(w)] for y in range(h)]
    removed = sum(row.count(True) for row in mask)
    total = w * h
    if removed < total * 0.02:
        return ('sem-fundo-detectado', removed, fname)

    px = img.load()
    # CASCA: pixels não-fundo vizinhos da máscara (8-conexidade, 2px).
    # Só aqui entra a suavização/defringe — o interior escuro do sprite
    # (não conectado ao fundo) permanece 100% opaco.
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
    # 2º anel da casca p/ anti-alias de 2px
    shell2 = set()
    for (sx, sy) in shell:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = sx + dx, sy + dy
                if 0 <= ny < h and 0 <= nx < w and not mask[ny][nx]:
                    shell2.add((nx, ny))

    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                px[x, y] = (0, 0, 0, 0)
    for (x, y) in shell2:
        r, g, b = px[x, y][:3]
        dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        if dist < SOFT:
            a = max(0, min(255, int(255 * (dist - THRESH * 0.5) / (SOFT - THRESH * 0.5))))
            px[x, y] = (r, g, b, a)

    # grava em disco: PNG mantém o nome; JPEG vira .png (JPEG não tem alfa)
    base, ext = os.path.splitext(path)
    if ext.lower() in ('.jpeg', '.jpg'):
        img.save(base + '.png')
        os.remove(path)
        return ('ok-jpeg->png', removed, os.path.basename(base) + '.png')
    img.save(path)
    return ('ok', removed, fname)


def main():
    dry = '--dry' in sys.argv
    stats = {}
    for folder in TARGET_DIRS:
        dirp = os.path.join(ROOT, folder)
        if not os.path.isdir(dirp):
            continue
        for fname in sorted(os.listdir(dirp)):
            if not fname.lower().endswith(('.png', '.jpeg', '.jpg')):
                continue
            if fname in EXCLUDE:
                continue
            path = os.path.join(dirp, fname)
            try:
                if dry:
                    img = Image.open(path).convert('RGBA')
                    bg = corner_bg(img)
                    status = 'ja-alfa' if has_alpha(img) else ('fundo-invalido' if bg is None else 'processaria')
                    removed, newname = 0, fname
                else:
                    status, removed, newname = strip(path)
                stats[status] = stats.get(status, 0) + 1
                if status.startswith('ok'):
                    print(f'  [LIMPO] {folder}/{fname} (-{removed}px)' +
                          (f' -> {newname}' if status == 'ok-jpeg->png' else ''))
                elif status not in ('ja-alfa',):
                    print(f'  [{status}] {folder}/{fname}')
            except Exception as ex:
                print(f'  [ERRO] {folder}/{fname}: {ex}')
    print(f'\nResumo: {stats}')


if __name__ == '__main__':
    main()