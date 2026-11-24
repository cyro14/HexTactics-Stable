import os, re, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

# Read all files in Novos 8bits
novos_units = sorted(os.listdir(os.path.join(NOVOS, 'units')))
novos_boss = sorted(os.listdir(os.path.join(NOVOS, 'boss')))
novos_leaders = sorted(os.listdir(os.path.join(NOVOS, 'leaders')))
novos_baby = sorted(os.listdir(os.path.join(NOVOS, 'baby')))

with open(os.path.join(ROOT, 'js', 'data.js'), 'r', encoding='utf-8') as f:
    data_js = f.read()

# Build comprehensive mapping for all files
all_files = []
for f in novos_units: all_files.append(('units', f, f"img/sprites/Novos 8bits/units/{f}"))
for f in novos_boss: all_files.append(('boss', f, f"img/sprites/Novos 8bits/boss/{f}"))
for f in novos_leaders: all_files.append(('leaders', f, f"img/sprites/Novos 8bits/leaders/{f}"))
for f in novos_baby: all_files.append(('baby', f, f"img/sprites/Novos 8bits/baby/{f}"))

print(f"Total files: {len(all_files)}")
