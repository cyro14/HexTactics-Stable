import os, re, glob, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

with open(os.path.join(ROOT, 'js', 'data.js'), 'r', encoding='utf-8') as f:
    data_js = f.read()

# Collect all files in Novos 8bits
all_novos = {}
for root, dirs, fnames in os.walk(NOVOS):
    cat = os.path.basename(root)
    for fn in fnames:
        if fn.lower().endswith('.png'):
            rel = f"img/sprites/Novos 8bits/{cat}/{fn}"
            all_novos[fn.lower()] = rel

print(f"Total Novos files: {len(all_novos)}")

# Check matching with existing beasts
# Let's inspect which files in Novos/units have a name matching BEASTS.LAND/WATER/SNOW
