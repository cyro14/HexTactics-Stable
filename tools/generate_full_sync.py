import os, re, glob, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

with open(os.path.join(ROOT, 'js', 'data.js'), 'r', encoding='utf-8') as f:
    data_js = f.read()

# 1. Gather all files in Novos 8bits
novos_units = sorted(os.listdir(os.path.join(NOVOS, 'units')))
novos_boss = sorted(os.listdir(os.path.join(NOVOS, 'boss')))
novos_leaders = sorted(os.listdir(os.path.join(NOVOS, 'leaders')))
novos_baby = sorted(os.listdir(os.path.join(NOVOS, 'baby')))

print(f"Novos units: {len(novos_units)}")
print(f"Novos boss: {len(novos_boss)}")
print(f"Novos leaders: {len(novos_leaders)}")
print(f"Novos baby: {len(novos_baby)}")

# 2. Let's analyze existing units in data.js
# Extract BEASTS lists
def parse_beasts_section(section_name):
    m = re.search(r'\b' + section_name + r':\s*\[(.*?)\](?=,\s*(?:WATER|SNOW|BOSSES|ELITES|\n\s*\}))', data_js, re.S)
    if not m:
        m = re.search(r'\b' + section_name + r':\s*\[(.*?)\]', data_js, re.S)
    if not m: return []
    objs = re.findall(r'\{([^{}]+)\}', m.group(1))
    results = []
    for o in objs:
        nm = re.search(r"name:\s*['\"]([^'\"]+)['\"]", o)
        sm = re.search(r"sprite:\s*['\"]([^'\"]+)['\"]", o)
        results.append((nm.group(1) if nm else '', sm.group(1) if sm else ''))
    return results

print("LAND:", len(parse_beasts_section('LAND')))
print("WATER:", len(parse_beasts_section('WATER')))
print("SNOW:", len(parse_beasts_section('SNOW')))
print("BOSSES:", len(parse_beasts_section('BOSSES')))
print("ELITES:", len(parse_beasts_section('ELITES')))
