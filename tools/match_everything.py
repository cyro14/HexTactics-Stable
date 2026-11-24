import os, re, glob, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

# Read all files in Novos 8bits
all_files = {}
for cat in ['units', 'boss', 'leaders', 'baby']:
    p = os.path.join(NOVOS, cat)
    for fn in os.listdir(p):
        if fn.lower().endswith('.png'):
            rel = f"img/sprites/Novos 8bits/{cat}/{fn}"
            all_files[fn] = (cat, rel)

print(f"Total files: {len(all_files)}")
