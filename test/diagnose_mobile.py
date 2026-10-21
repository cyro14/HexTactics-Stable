# Diagnóstico do modo retrato (mini-card + FAB + action bar nos cantos)
from PIL import Image

img = Image.open("test/artifacts/battle_visual_mobile.png").convert("RGB")
w, h = img.size
print(f"Imagem: {w}x{h}")

def count(x0, x1, y0, y1, cond, step=1):
    return sum(1 for y in range(y0, y1, step) for x in range(x0, x1, step) if cond(*img.getpixel((x, y))))

# 1) Headset (y 4-44) e mini-card (y 46-130): dourados (badge/nome/selo i)
head_gold = count(0, w, 4, 46, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
card_gold = count(0, w, 46, 132, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
hp = count(0, w, 46, 132, lambda r, g, b: r > 150 and g < 110 and b < 100, 2)
mp = count(0, w, 46, 132, lambda r, g, b: r < 130 and g > 80 and b > 150, 2)
print(f"Headset dourado (y 4-46): {head_gold}")
print(f"Mini-card dourado (y 46-132): {card_gold} | HP px: {hp} | MP px: {mp}")

# 2) Onde termina o card? varre x=200 procurando o fundo escuro do card
card_end = None
for y in range(44, 180, 2):
    r, g, b = img.getpixel((200, y))
    if r < 30 and g < 30 and b < 40:  # fundo do card/moldura escura
        card_end = y
        break
print(f"Card termina em: y~{card_end}")

# 3) Mapa livre: entre o card (~130) e a base (~710)
print(f"Faixa livre de mapa: y ~{card_end or 130} até ~710 = {710 - (card_end or 130)}px ({100*(710 - (card_end or 130))/h:.0f}% da tela)")

# 4) Crônica recolhida (top: 134, fita ~32px)
log_gold = count(100, w, 130, 175, lambda r, g, b: r > 160 and g > 120 and b < 100, 2)
print(f"Crônica recolhida dourada (y 130-175): {log_gold}")

# 5) Action bar bottom-left + FAB Pronto bottom-right
ab = count(0, 250, h - 90, h, lambda r, g, b: r > 150 and g > 100 and b < 90, 2)
fab = count(w - 130, w, h - 110, h, lambda r, g, b: r > 180 and g > 140 and b < 100, 2)
print(f"Action bar esquerda (base): {ab} | FAB Pronto (canto direito): {fab}")

# 6) Amostras da coluna central no meio do mapa (deve ser TERRENO, não UI)
print("\nAmostras do mapa (x=200):")
for y in range(200, 700, 100):
    print(f"  y={y}: {img.getpixel((200, y))}")