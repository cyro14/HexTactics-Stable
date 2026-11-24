import os, sys, json, re

# Let's write a builder that constructs the new data.js cleanly
with open('js/data.js', 'r', encoding='utf-8') as f:
    orig_data_js = f.read()

with open('tools/registries.json', 'r', encoding='utf-8') as f:
    regs = json.load(f)

with open('tools/complete_sprite_map.json', 'r', encoding='utf-8') as f:
    complete_sprite_map = json.load(f)

from step9_new_beasts_def import NEW_LAND_BEASTS, NEW_WATER_BEASTS, NEW_SNOW_BEASTS
from step11_new_leaders_def import NEW_LEADERS
from step12_baby_mega_def import BABY_BEASTS, MEGA_BEASTS
from step8_prep_data import extended_evos

# 1. Update LEADERS in orig_data_js:
# Replace leader entries with 8bit sprites and append NEW_LEADERS
# Leaders to update with 8bit sprites:
# Arquimago -> img/sprites/Novos 8bits/leaders/archemage.png
# Chefe Orc -> img/sprites/Novos 8bits/leaders/orc.png
# Necromante -> img/sprites/Novos 8bits/leaders/necromante.png
# Arqueira -> img/sprites/Novos 8bits/leaders/darkelf-archer.png
# Lord Vampiro -> img/sprites/Novos 8bits/leaders/vampire.png
# Centauro Espectral -> img/sprites/Novos 8bits/leaders/mystic-centaur.png
# Anubis -> img/sprites/Novos 8bits/leaders/anubis.png
# Sereia -> img/sprites/Novos 8bits/leaders/siren.png
# Bruxa -> img/sprites/Novos 8bits/leaders/witch.png
# Rei Bárbaro -> img/sprites/Novos 8bits/leaders/human-king-dia.png
# T-Rex -> img/sprites/Novos 8bits/leaders/Rock-rex.png
# Rainha do Gelo -> img/sprites/Novos 8bits/leaders/yuki.png
# Matriarca Harpia -> img/sprites/Novos 8bits/leaders/harpia.png
# Gárgula Anciã -> img/sprites/Novos 8bits/leaders/gargula.png
# Doutor da Praga -> img/sprites/Novos 8bits/leaders/plague-doctor.png
# Cthullu -> img/sprites/Novos 8bits/leaders/cthulhu.png

print("Prepared data structures for patch.")
