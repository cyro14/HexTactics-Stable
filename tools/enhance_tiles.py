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
# Uso: python tools/enhance_tiles.py
# ==========================================
import os
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'img', 'tiles')

# (arquivo, colunas esperadas) — célula alvo ~260x300 (2x o hex em tela)
SHEETS = [
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
    img.save(path, optimize=True)
    return (f'{fname}: {w}x{h} -> {img.size[0]}x{img.size[1]} '
            f'({before_kb}KB -> {os.path.getsize(path)//1024}KB)')


def main():
    msg = ensure_areia()
    if msg:
        print(f'  [CONV] {msg}')
    for fname, cols in SHEETS:
        path = os.path.join(TILES, fname)
        if not os.path.exists(path):
            print(f'  [PULA] {fname}: ausente')
            continue
        try:
            print(f'  [OK] {enhance(fname, cols)}')
        except Exception as ex:
            print(f'  [ERRO] {fname}: {ex}')
    print('Pós-processamento concluído.')


if __name__ == '__main__':
    main()