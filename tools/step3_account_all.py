import os, re, json
from step2_registries import DAY_NIGHT_REGISTRY, EVO_SPRITES_REGISTRY

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

novos_units = sorted(os.listdir(os.path.join(NOVOS, 'units')))
novos_boss = sorted(os.listdir(os.path.join(NOVOS, 'boss')))
novos_leaders = sorted(os.listdir(os.path.join(NOVOS, 'leaders')))
novos_baby = sorted(os.listdir(os.path.join(NOVOS, 'baby')))

# Let's collect ALL files and make sure each is accounted for
accounted_files = set()

for d in DAY_NIGHT_REGISTRY.values():
    for p in d.values():
        accounted_files.add(os.path.basename(p))

for d in EVO_SPRITES_REGISTRY.values():
    for p in d.values():
        accounted_files.add(os.path.basename(p))

all_novos_set = set(novos_units + novos_boss + novos_leaders + novos_baby)
unaccounted = sorted(list(all_novos_set - accounted_files))
print(f"Total Novos files: {len(all_novos_set)}")
print(f"Accounted so far: {len(accounted_files)}")
print(f"Unaccounted ({len(unaccounted)}):")
for f in unaccounted:
    print(" ", f)
