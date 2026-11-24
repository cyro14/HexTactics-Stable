import os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Let's inspect all files in Novos 8bits
novos_units = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/units')))
novos_boss = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/boss')))
novos_leaders = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/leaders')))
novos_baby = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/baby')))

print("=== UNITS FILES ===")
print(novos_units)

print("=== BOSS FILES ===")
print(novos_boss)

print("=== LEADERS FILES ===")
print(novos_leaders)

print("=== BABY FILES ===")
print(novos_baby)
