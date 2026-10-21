# Diagnóstico do layout mobile compacto (400x800)
from PIL import Image

img = Image.open("test/artifacts/battle_visual_mobile.png").convert("RGB")
w, h = img.size
print(f"Imagem: {w}x{h}")

def count(x0, x1, y0, y1, cond, step=1):
    return sum(1 for y in range(y0, y1, step) for x in range(x0, x1, step) if cond(*img.getpixel((x, y))))

# 1) Mapa visível: fração da tela que NÃO é UI (faixa livre entre
#    ribbon (~92px) e bottom-sheet (~46vh=368 -> topo em y=432)
free_top, free_bottom = 92, h - 368
print(f"\nFaixa livre de mapa com painel aberto: y {free_top}-{free_bottom} ({100*(free_bottom-free_top)/h:.0f}% da tela)")
print(f"Faixa livre sem painel (só topo): y 0-{free_bottom} do topo ocupado: {free_top}px")

# 2) Barra superior compacta: y 4-44 (dourados do turno/ouro)
top_gold = count(0, w, 4, 48, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
print(f"Dourados na barra superior (y 4-48): {top_gold}")

# 3) Ribbon action bar: y 46-90 (botões utilitários + slot de magia)
ab = count(0, w, 46, 92, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
print(f"Dourados na ribbon (y 46-92): {ab}")

# 4) Crônica recolhida: y 92-126, x direita (header dourado)
lg = count(120, w, 90, 130, lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
print(f"Dourados na crônica recolhida (y 90-130): {lg}")

# 5) Painel bottom-sheet: retrato horizontal (y ~440-520) e Pronto (base)
panel_dark = count(0, w, h - 368, h, lambda r, g, b: r < 35 and g < 35 and b < 40, 4)
print(f"Pixels escuros do painel (base 46vh): {panel_dark}")
ready = count(0, w, h - 120, h, lambda r, g, b: r > 180 and g > 140 and b < 100, 2)
print(f"Dourados do Pronto (base): {ready}")

# 6) Altura real do chrome do topo: varre colunas do centro procurando
#    onde o mapa (colorido) começa após a UI
print("\nCores numa coluna central (x=200) de y=0 a 140:")
for y in range(0, 140, 10):
    print(f"  y={y}: {img.getpixel((200, y))}")