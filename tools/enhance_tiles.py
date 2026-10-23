# ==========================================
# PÓS-PROCESSAMENTO DE TILES — Biomancer Tactics
# Dois problemas resolvidos:
#  1. Artes de IA em ~800px/célula: o browser não sabe reduzir 8x numa
#     única drawImage (fica esfarelado). Aqui a redução é feita OFFLINE
#     com LANCZOS para o tamanho certo (~2x o hex na tela) = nítido.
#  2. "Flat/sem graça": unsharp mask + saturação + contraste suaves
#     dão o "pop" de qualidade sem estourar.
#
# Também NORMALIZA o areia_movedica (.jfif -> .png, o nome que a data.js
# espera) e mantém a estrutura de colunas de cada sheet.
#
# Com --sprites (ou 'all'): aplica o MESMO realce aos sprites de
# unidades/bosses/líderes (preservando o canal alfa).
#
# Uso: python tools/enhance_tiles.py [--sprites|--all] [--force]
# ==========================================
import os
import sys
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'img', 'tiles')

# (arquivo, colunas esperadas) — célula alvo ~260x300 (2x o hex em tela)
SHEETS = [
    ('tileset.png', 6),             # tileset principal ganha o MESMO tratamento
    ('agua_eletrificada.png', 6),
    ('areia_movedica.png', 6),      # virá do .jfif convertido
    ('fenda_lava.png', 6),
    ('fenda_mana.png', 6),
    ('recife.png', 6),
    ('jazida_dna.png', 6),
    ('jazida_ouro.png', 6),
    ('mercado_negro.png', 6),
]
TARGET_CELL_W = 260          # largura alvo por célula
SHARPEN = (2, 110, 2)         # unsharp mask (raio, %, threshold)
SATURATION = 1.12             # +12% de cor
CONTRAST = 1.04               # +4% de contraste

# ---- SPRITES: mesmos nitidez/cor/contraste, preservando o canal ALFA ----
SPRITE_DIRS = ['img/units', 'img/boss', 'img/sprites', 'img/lideres']
SPRITE_MAX_W = 340            # teto de largura (nunca amplia; unidades
                              # desenham a ~150px no máximo — 2.2x de folga)
SPRITE_EXCLUDE = {
    'units1.png', 'units2.png', 'units3.png',       # sheets
    'boss.png', 'boss2.png', 'boss3.png', 'boss4.png',
    'leaders.png',
    'icons.png', 'icones.png', 'tileset.png', 'spells.jpeg', 'sol.png', 'water.png',
    'reino.jpeg',
    '1-removebg-preview (1).png',
    'WhatsApp_Image_2026-06-02_at_08.58.09-removebg-preview.png',
}


def _was_enhanced(path):
    try:
        return Image.open(path).info.get('enhanced') == '1'
    except Exception:
        return False


def _save_marked(img, path):
    from PIL import PngImagePlugin
    meta = PngImagePlugin.PngInfo()
    meta.add_text('enhanced', '1')
    img.save(path, optimize=True, pnginfo=meta)


def _enhance_rgb(rgb):
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=SHARPEN[0], percent=SHARPEN[1], threshold=SHARPEN[2]))
    rgb = ImageEnhance.Color(rgb).enhance(SATURATION)
    rgb = ImageEnhance.Contrast(rgb).enhance(CONTRAST)
    return rgb


def enhance_sprite(path):
    """sprite com canal alfa: realce só no RGB (o alfa fica intacto)"""
    img = Image.open(path).convert('RGBA')
    rgb = img.convert('RGB')
    alpha = img.getchannel('A')
    if rgb.width > SPRITE_MAX_W:
        k = SPRITE_MAX_W / rgb.width
        nw, nh = SPRITE_MAX_W, max(1, int(rgb.height * k))
        rgb = rgb.resize((nw, nh), Image.LANCZOS)
        alpha = alpha.resize((nw, nh), Image.LANCZOS)
    rgb = _enhance_rgb(rgb)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    _save_marked(out, path)
    return f'{os.path.basename(path)}: {img.size[0]}x{img.size[1]} -> {out.size[0]}x{out.size[1]}'


def ensure_areia():
    """data.js aponta para areia_movedica.png; se só existir o .jfif, converte"""
    dst = os.path.join(TILES, 'areia_movedica.png')
    if os.path.exists(dst):
        return None
    src = os.path.join(TILES, 'areia_movedica.jfif')
    if not os.path.exists(src):
        return 'areia_movedica: nem .png nem .jfif encontrados!'
    img = Image.open(src).convert('RGB')
    img.save(dst)
    return f'areia_movedica.jfif -> areia_movedica.png convertido ({img.size[0]}x{img.size[1]})'


def enhance(fname, cols):
    path = os.path.join(TILES, fname)
    # IDEMPOTENTE: metadado 'enhanced' no PNG evita acumular nitidez/
    # saturação em passagens repetidas (use --force para reprocessar)
    force = '--force' in sys.argv
    try:
        if not force and Image.open(path).info.get('enhanced') == '1':
            return f'{fname}: já processado (use --force para repetir)'
    except Exception:
        pass
    img = Image.open(path).convert('RGB')
    w, h = img.size
    cell_w = w / cols
    # só reduz se estiver estourado (nunca amplia)
    if cell_w > TARGET_CELL_W * 1.5:
        k = TARGET_CELL_W / cell_w
        img = img.resize((max(cols * TARGET_CELL_W, int(w * k)), int(h * k)), Image.LANCZOS)
    # pós-processamento: nitidez + cor + contraste
    img = img.filter(ImageFilter.UnsharpMask(radius=SHARPEN[0], percent=SHARPEN[1], threshold=SHARPEN[2]))
    img = ImageEnhance.Color(img).enhance(SATURATION)
    img = ImageEnhance.Contrast(img).enhance(CONTRAST)
    before_kb = os.path.getsize(path) // 1024
    from PIL import PngImagePlugin
    meta = PngImagePlugin.PngInfo()
    meta.add_text('enhanced', '1')
    img.save(path, optimize=True, pnginfo=meta)
    return (f'{fname}: {w}x{h} -> {img.size[0]}x{img.size[1]} '
            f'({before_kb}KB -> {os.path.getsize(path)//1024}KB)')


def main():
    force = '--force' in sys.argv
    do_sprites = '--sprites' in sys.argv or 'all' in sys.argv
    msg = ensure_areia()
    if msg:
        print(f'  [CONV] {msg}')
    for fname, cols in SHEETS:
        path = os.path.join(TILES, fname)
        if not os.path.exists(path):
            print(f'  [PULA] {fname}: ausente')
            continue
        try:
            if not force and _was_enhanced(path):
                print(f'  [PULA] {fname}: já processado')
                continue
            print(f'  [OK] {enhance(fname, cols)}')
        except Exception as ex:
            print(f'  [ERRO] {fname}: {ex}')

    if do_sprites:
        print('--- SPRITES (unidades, bosses, líderes) ---')
        for folder in SPRITE_DIRS:
            dirp = os.path.join(ROOT, folder)
            if not os.path.isdir(dirp):
                continue
            for fname in sorted(os.listdir(dirp)):
                if not fname.lower().endswith('.png'):
                    continue
                if fname in SPRITE_EXCLUDE:
                    continue
                path = os.path.join(dirp, fname)
                if not force and _was_enhanced(path):
                    continue
                try:
                    print(f'  [OK] {enhance_sprite(path)}')
                except Exception as ex:
                    print(f'  [ERRO] {folder}/{fname}: {ex}')
    print('Pós-processamento concluído.')


if __name__ == '__main__':
    main()