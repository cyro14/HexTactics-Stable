import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Let's read all filenames in img/sprites/Novos 8bits
novos_units = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/units')))
novos_boss = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/boss')))
novos_leaders = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/leaders')))
novos_baby = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/baby')))

print(f"novos_units: {len(novos_units)}")
print(f"novos_boss: {len(novos_boss)}")
print(f"novos_leaders: {len(novos_leaders)}")
print(f"novos_baby: {len(novos_baby)}")
