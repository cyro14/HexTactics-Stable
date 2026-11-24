import os, re, glob
from collections import defaultdict

with open('js/data.js', 'r', encoding='utf-8') as f:
    data_js = f.read()

# Map all files in Novos 8bits
novos_by_folder = defaultdict(dict)
for root, dirs, files in os.walk(r'img\sprites\Novos 8bits'):
    folder = os.path.basename(root)
    for file in files:
        rel = os.path.join(root, file).replace('\\', '/')
        name_no_ext = os.path.splitext(file)[0].lower()
        novos_by_folder[folder][name_no_ext] = rel

print("Novos 8bits summary:")
for folder, d in novos_by_folder.items():
    print(f"  {folder}: {len(d)} files")

# Print all leader sprites compared to Novos 8bits/leaders
m = re.search(r'const LEADERS\s*=\s*\[(.*?)\];', data_js, re.S)
if m:
    objs = re.findall(r'\{([^{}]+)\}', m.group(1))
    print(f"\nLEADERS ({len(objs)}):")
    for obj in objs:
        id_m = re.search(r"id:\s*['\"]([^'\"]+)['\"]", obj)
        name_m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", obj)
        sprite_m = re.search(r"sprite:\s*['\"]([^'\"]+)['\"]", obj)
        lid = id_m.group(1) if id_m else '?'
        lname = name_m.group(1) if name_m else '?'
        lsprite = sprite_m.group(1) if sprite_m else '?'
        print(f"  {lid:18} | {lname:22} | {lsprite}")
