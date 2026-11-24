import os, sys, json, re

# Build complete BEAST_SPRITE_MAP
with open('tools/registries.json', 'r', encoding='utf-8') as f:
    regs = json.load(f)

from step9_new_beasts_def import NEW_LAND_BEASTS, NEW_WATER_BEASTS, NEW_SNOW_BEASTS
from step11_new_leaders_def import NEW_LEADERS
from step12_baby_mega_def import BABY_BEASTS, MEGA_BEASTS
from step8_prep_data import extended_evos

# Collect ALL sprite mappings:
COMPLETE_SPRITE_MAP = {}

# 1. Day / Night base mapping
for k, v in regs['DAY_NIGHT'].items():
    COMPLETE_SPRITE_MAP[k] = v['day']

# 2. Evo sprites
for k, v in regs['EVO_SPRITES'].items():
    if 1 in v:
        COMPLETE_SPRITE_MAP[k] = v[1]
    elif '1' in v:
        COMPLETE_SPRITE_MAP[k] = v['1']

# 3. Single sprites
for k, v in regs['SINGLE_SPRITES'].items():
    COMPLETE_SPRITE_MAP[k] = v

# 4. Baby sprites
for k, v in regs['BABY_SPRITES'].items():
    COMPLETE_SPRITE_MAP[k] = v

# 5. New beasts
for b in NEW_LAND_BEASTS + NEW_WATER_BEASTS + NEW_SNOW_BEASTS + BABY_BEASTS + MEGA_BEASTS:
    COMPLETE_SPRITE_MAP[b['name']] = b['sprite']

# 6. New leaders
for l in NEW_LEADERS:
    COMPLETE_SPRITE_MAP[l['name']] = l['sprite']

# 7. Check existing BEAST_SPRITE_MAP in data.js to preserve any existing valid entries
with open('js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'const BEAST_SPRITE_MAP = \{(.*?)\};', text, re.S)
if m:
    pairs = re.findall(r"['\"]([^'\"]+)['\"]\s*:\s*['\"]([^'\"]+)['\"]", m.group(1))
    for k, v in pairs:
        if k not in COMPLETE_SPRITE_MAP:
            COMPLETE_SPRITE_MAP[k] = v

print(f"COMPLETE_SPRITE_MAP entries: {len(COMPLETE_SPRITE_MAP)}")
with open('tools/complete_sprite_map.json', 'w', encoding='utf-8') as f:
    json.dump(COMPLETE_SPRITE_MAP, f, indent=2, ensure_ascii=False)
