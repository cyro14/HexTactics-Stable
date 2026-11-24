import os, sys, json
sys.path.append('tools')
from step2_registries import DAY_NIGHT_REGISTRY, EVO_SPRITES_REGISTRY
from step4_full_coverage import ADDITIONAL_EVOS, SINGLE_SPRITES
from step5_baby_coverage import BABY_SPRITES

# Merge EVO_SPRITES_REGISTRY and ADDITIONAL_EVOS
MERGED_EVO_SPRITES = {}
for k, v in EVO_SPRITES_REGISTRY.items():
    MERGED_EVO_SPRITES[k] = v.copy()
for k, v in ADDITIONAL_EVOS.items():
    if k in MERGED_EVO_SPRITES:
        MERGED_EVO_SPRITES[k].update(v)
    else:
        MERGED_EVO_SPRITES[k] = v.copy()

# Add lizard (2).png alias
if 'Lagarto' in MERGED_EVO_SPRITES:
    MERGED_EVO_SPRITES['Lagarto'][2] = 'img/sprites/Novos 8bits/units/lizard-2.png'

# Save registries to JSON for embedding into data.js
with open('tools/registries.json', 'w', encoding='utf-8') as f:
    json.dump({
        'DAY_NIGHT': DAY_NIGHT_REGISTRY,
        'EVO_SPRITES': MERGED_EVO_SPRITES,
        'SINGLE_SPRITES': SINGLE_SPRITES,
        'BABY_SPRITES': BABY_SPRITES
    }, f, indent=2, ensure_ascii=False)

print("Generated tools/registries.json successfully!")
