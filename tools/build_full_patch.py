import os, re, glob, json
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

# Let's write a script that outputs:
# 1. Day / Night mapping
# 2. EVOS mapping (base -> [evo2, evo3]) and sprite mapping for levels
# 3. Bestiary / BEAST_SPRITE_MAP mapping
# 4. Units/Bosses created or updated

print("Checking structure...")
