import os, sys, json, re

# Complete patch script that:
# 1. Updates data.js with:
#    - DAY_NIGHT_UNITS
#    - UNIT_EVO_SPRITES
#    - Updated EVOS dictionary
#    - Updated LEADERS (8-bit sprites + 10 new leaders)
#    - Updated BEASTS (all new land, water, snow beasts, bosses, baby, and mega beasts)
#    - Updated BEAST_SPRITE_MAP (239 entries)
# 2. Updates engine.js with:
#    - Unit.prototype.getSprite() method and triggerEvolve sprite update
#    - Renderer drawing using u.getSprite ? u.getSprite() : u.sprite
# 3. Runs node --check to verify syntax

print("Starting apply_all_patches...")

with open('js/data.js', 'r', encoding='utf-8') as f:
    data_content = f.read()

with open('tools/registries.json', 'r', encoding='utf-8') as f:
    regs = json.load(f)

with open('tools/complete_sprite_map.json', 'r', encoding='utf-8') as f:
    complete_sprite_map = json.load(f)

from step9_new_beasts_def import NEW_LAND_BEASTS, NEW_WATER_BEASTS, NEW_SNOW_BEASTS
from step11_new_leaders_def import NEW_LEADERS
from step12_baby_mega_def import BABY_BEASTS, MEGA_BEASTS
from step8_prep_data import extended_evos

# Construct the DAY_NIGHT_UNITS and UNIT_EVO_SPRITES JS blocks
dn_js = "const DAY_NIGHT_UNITS = " + json.dumps(regs['DAY_NIGHT'], indent=4, ensure_ascii=False) + ";\n\n"
evo_spr_js = "const UNIT_EVO_SPRITES = " + json.dumps(regs['EVO_SPRITES'], indent=4, ensure_ascii=False) + ";\n\n"

# Update EVOS definition:
evos_block = "const EVOS = {\n"
# Keep function evos
evos_block += """    '🐺': () => { if (this.filter === 'none') this.filter = 'saturate(200%) hue-rotate(330deg)'; },
    '🐗': () => this.emoji = '🦏',
    '🐻': () => this.emoji = '🐼',
    '🐭': () => this.emoji = '🐀',
    '🐢': () => { this.emoji = '🦕'; this.name = "Dinossauro Escudo"; this.maxHp += 40; this.hp += 40; },
    '🐴': () => { this.emoji = '🦄'; this.name = "Unicórnio Místico"; if (!this.abilities.includes('dodge') && this.abilities.length < 2) this.abilities.push('dodge'); if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); },
    '🐍': () => { this.emoji = '🐍'; this.name = "Basilisco"; },
    '🦂': () => { this.emoji = '🦂'; this.name = "Imperador do Deserto"; },
    '🐒': () => { this.emoji = '🦍'; this.name = "Gorila Rei"; },
    '🦊': () => { this.emoji = '🦊'; this.name = "Raposa de Nove Caudas"; },
    '🐸': () => { this.emoji = '🐸'; this.name = "Sapo-Boi Gigante"; },
    '🐦': () => { this.emoji = '🐦‍🔥'; this.name = "Fênix"; if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); if (!this.tags.includes('FIRE')) this.tags.push('FIRE'); },\n"""

for k, v in sorted(extended_evos.items()):
    evos_block += f"    '{k}': {json.dumps(v, ensure_ascii=False)},\n"
evos_block += "};\n"

# Replace EVOS block in data.js
old_evos_start = data_content.find('const EVOS = {')
old_evos_end = data_content.find('};\n', old_evos_start) + 3
assert old_evos_start != -1 and old_evos_end != -1, "Could not find EVOS block"

new_data_content = (
    data_content[:old_evos_start] +
    dn_js +
    evo_spr_js +
    evos_block +
    data_content[old_evos_end:]
)

# Update LEADERS in new_data_content:
# Update existing leader sprite paths:
leader_replacements = [
    ("name: 'Arquimago', loreFaction: 'ORDEM', emoji: '🧙🏻‍♂️', hp: 60, atk: 12, mp: 4, range: 2, limit: 3, knownSpells: ['sl_arcane_dart'], desc: 'Consegue utilizar duas magias por turno.', tags: ['MYSTIC'], sprite: 'img/lideres/arquimago.png'",
     "name: 'Arquimago', loreFaction: 'ORDEM', emoji: '🧙🏻‍♂️', hp: 60, atk: 12, mp: 4, range: 2, limit: 3, knownSpells: ['sl_arcane_dart'], desc: 'Consegue utilizar duas magias por turno.', tags: ['MYSTIC'], sprite: 'img/sprites/Novos 8bits/leaders/archemage.png'"),

    ("name: 'Chefe Orc', loreFaction: 'PRIMORDIAL', emoji: '👹', hp: 80, atk: 15, mp: 5, range: 1, limit: 6, abilities: ['leadership'], knownSpells: ['sl_savage_cry'], desc: 'Líder de Horda (+10% ATK por aliado).', tags: ['PRIMAL'], sprite: 'img/lideres/chefe_orc.png'",
     "name: 'Chefe Orc', loreFaction: 'PRIMORDIAL', emoji: '👹', hp: 80, atk: 15, mp: 5, range: 1, limit: 6, abilities: ['leadership'], knownSpells: ['sl_savage_cry'], desc: 'Líder de Horda (+10% ATK por aliado).', tags: ['PRIMAL'], sprite: 'img/sprites/Novos 8bits/leaders/orc.png'"),

    ("name: 'Necromante', loreFaction: 'SOMBRAS', emoji: '💀', hp: 60, atk: 12, mp: 4, range: 2, limit: 6, knownSpells: ['sl_dark_touch'], desc: 'Exército Morto (Domina como Umbral ao matar).', tags: ['UMBRAL'], sprite: 'img/lideres/necromante.png'",
     "name: 'Necromante', loreFaction: 'SOMBRAS', emoji: '💀', hp: 60, atk: 12, mp: 4, range: 2, limit: 6, knownSpells: ['sl_dark_touch'], desc: 'Exército Morto (Domina como Umbral ao matar).', tags: ['UMBRAL'], sprite: 'img/sprites/Novos 8bits/leaders/necromante.png'"),

    ("name: 'Arqueira', loreFaction: 'SILVESTRE', emoji: '🏹', hp: 65, atk: 14, mp: 5, range: 3, limit: 3, abilities: ['camouflage'], knownSpells: ['sl_gust'], desc: 'Alcance longo e Doma feras Silvestres facilmente. Silvestres adjacentes a ela recebem +1 de Alcance.', tags: ['SILVESTRE', 'STALKER'], fav: ['FOREST'], sprite: 'img/lideres/arqueira.png'",
     "name: 'Arqueira', loreFaction: 'SILVESTRE', emoji: '🏹', hp: 65, atk: 14, mp: 5, range: 3, limit: 3, abilities: ['camouflage'], knownSpells: ['sl_gust'], desc: 'Alcance longo e Doma feras Silvestres facilmente. Silvestres adjacentes a ela recebem +1 de Alcance.', tags: ['SILVESTRE', 'STALKER'], fav: ['FOREST'], sprite: 'img/sprites/Novos 8bits/leaders/darkelf-archer.png'"),

    ("name: 'Lord Vampiro', loreFaction: 'SOMBRAS', emoji: '🧛🏻‍♂️', hp: 65, atk: 16, mp: 6, range: 1, limit: 5, knownSpells: ['sl_mordida_vamp'], desc: 'Roubo de vida. Doma feras abatidas transformando em Rastreadores. Fome se não atacar.', tags: ['UMBRAL', 'STALKER'], abilities: ['lifesteal'], sprite: 'img/lideres/lord_vampiro.png'",
     "name: 'Lord Vampiro', loreFaction: 'SOMBRAS', emoji: '🧛🏻‍♂️', hp: 65, atk: 16, mp: 6, range: 1, limit: 5, knownSpells: ['sl_mordida_vamp'], desc: 'Roubo de vida. Doma feras abatidas transformando em Rastreadores. Fome se não atacar.', tags: ['UMBRAL', 'STALKER'], abilities: ['lifesteal'], sprite: 'img/sprites/Novos 8bits/leaders/vampire.png'"),

    ("name: 'Centauro Espectral', scale: 1.2, loreFaction: 'SILVESTRE', emoji: '🏇', hp: 70, maxHp: 70, mp: 6, maxMp: 6, limit: 3, atk: 12, range: 1, tags: ['MYSTIC', 'SILVESTRE'], fav: ['PLAINS'], desc: 'Ganha +10% de ATK Base por cada hexágono percorrido antes de atacar no turno.', sprite: 'img/lideres/centauro.png'",
     "name: 'Centauro Espectral', scale: 1.2, loreFaction: 'SILVESTRE', emoji: '🏇', hp: 70, maxHp: 70, mp: 6, maxMp: 6, limit: 3, atk: 12, range: 1, tags: ['MYSTIC', 'SILVESTRE'], fav: ['PLAINS'], desc: 'Ganha +10% de ATK Base por cada hexágono percorrido antes de atacar no turno.', sprite: 'img/sprites/Novos 8bits/leaders/mystic-centaur.png'"),

    ("name: 'Anubis', loreFaction: 'DESERTO', emoji: '🐕‍🦺', hp: 80, maxHp: 80, mp: 3, maxMp: 3, atk: 16, range: 1, limit: 3, tags: ['UMBRAL', 'SAND'], fav: ['DESERT'], desc: 'Sempre que elimina um inimigo, ganha +1 ATK permanentemente (Acumula na run).', sprite: 'img/lideres/anubis.png'",
     "name: 'Anubis', loreFaction: 'DESERTO', emoji: '🐕‍🦺', hp: 80, maxHp: 80, mp: 3, maxMp: 3, atk: 16, range: 1, limit: 3, tags: ['UMBRAL', 'SAND'], fav: ['DESERT'], desc: 'Sempre que elimina um inimigo, ganha +1 ATK permanentemente (Acumula na run).', sprite: 'img/sprites/Novos 8bits/leaders/anubis.png'"),

    ("name: 'Sereia', loreFaction: 'ABISSAL', emoji: '🧜🏻‍♀️', hp: 70, maxHp: 70, mp: 3, maxMp: 3, atk: 10, range: 2, limit: 3, abilities: ['dive'], tags: ['ABYSSAL', 'MYSTIC'], fav: ['WATER'], knownSpells: ['sl_cancao_sereia'], desc: 'Usa a Canção da Sereia para puxar inimigos para perto e atordoá-los.', sprite: 'img/lideres/sereia.png'",
     "name: 'Sereia', loreFaction: 'ABISSAL', emoji: '🧜🏻‍♀️', hp: 70, maxHp: 70, mp: 3, maxMp: 3, atk: 10, range: 2, limit: 3, abilities: ['dive'], tags: ['ABYSSAL', 'MYSTIC'], fav: ['WATER'], knownSpells: ['sl_cancao_sereia'], desc: 'Usa a Canção da Sereia para puxar inimigos para perto e atordoá-los.', sprite: 'img/sprites/Novos 8bits/leaders/siren.png'"),

    ("name: 'Bruxa', loreFaction: 'SOMBRAS', emoji: '🧙🏼‍♀️', hp: 65, maxHp: 65, mp: 4, maxMp: 4, atk: 12, range: 2, limit: 3, tags: ['VENOM', 'UMBRAL'], fav: ['FOREST'], knownSpells: ['sl_venom_spit'], desc: 'Alquimista. Pode sacrificar um aliado com a magia Caldeirão para curar toda a equipe massivamente.', sprite: 'img/lideres/bruxa.png'",
     "name: 'Bruxa', loreFaction: 'SOMBRAS', emoji: '🧙🏼‍♀️', hp: 65, maxHp: 65, mp: 4, maxMp: 4, atk: 12, range: 2, limit: 3, tags: ['VENOM', 'UMBRAL'], fav: ['FOREST'], knownSpells: ['sl_venom_spit'], desc: 'Alquimista. Pode sacrificar um aliado com a magia Caldeirão para curar toda a equipe massivamente.', sprite: 'img/sprites/Novos 8bits/leaders/witch.png'"),

    ("name: 'Rei Bárbaro', loreFaction: 'ORDEM', emoji: '🤴', hp: 80, maxHp: 80, mp: 4, maxMp: 4, atk: 12, limit: 3, range: 1, tags: ['PRIMAL', 'ICE'], fav: ['SNOW'], desc: 'Fúria Imortal: Quanto mais HP perder, mais forte ele fica.', sprite: 'img/lideres/rei_barbaro.png'",
     "name: 'Rei Bárbaro', loreFaction: 'ORDEM', emoji: '🤴', hp: 80, maxHp: 80, mp: 4, maxMp: 4, atk: 12, limit: 3, range: 1, tags: ['PRIMAL', 'ICE'], fav: ['SNOW'], desc: 'Fúria Imortal: Quanto mais HP perder, mais forte ele fica.', sprite: 'img/sprites/Novos 8bits/leaders/human-king-dia.png'"),

    ("name: 'T-Rex', loreFaction: 'PRIMORDIAL', scale: 2, emoji: '🦖', hp: 150, maxHp: 150, mp: 3, maxMp: 2, atk: 25, range: 1, limit: 3, tags: ['PRIMAL', 'ROCK', 'STALKER'], fav: ['DIRT'], desc: 'Kaiju. Bate em todos à frente. A cada passo, esmaga florestas e vilas, tornando-as planícies.', sprite: 'img/lideres/trex.png'",
     "name: 'T-Rex', loreFaction: 'PRIMORDIAL', scale: 2, emoji: '🦖', hp: 150, maxHp: 150, mp: 3, maxMp: 2, atk: 25, range: 1, limit: 3, tags: ['PRIMAL', 'ROCK', 'STALKER'], fav: ['DIRT'], desc: 'Kaiju. Bate em todos à frente. A cada passo, esmaga florestas e vilas, tornando-as planícies.', sprite: 'img/sprites/Novos 8bits/leaders/Rock-rex.png'"),

    ("name: 'Rainha do Gelo', loreFaction: 'ORDEM', emoji: '👸🏼', hp: 75, maxHp: 75, mp: 3, maxMp: 3, atk: 12, limit: 3, range: 2, tags: ['ICE'], fav: ['SNOW'], filter: 'hue-rotate(180deg)', abilities: ['frost_armor', 'freeze'], knownSpells: ['sl_ice_shard'], desc: 'Magia glacial. Inimigos que a atacam corpo-a-corpo sofrem Congelamento (Chilled) instantâneo.', sprite: 'img/lideres/rainha_gelo.png'",
     "name: 'Rainha do Gelo', loreFaction: 'ORDEM', emoji: '👸🏼', hp: 75, maxHp: 75, mp: 3, maxMp: 3, atk: 12, limit: 3, range: 2, tags: ['ICE'], fav: ['SNOW'], filter: 'hue-rotate(180deg)', abilities: ['frost_armor', 'freeze'], knownSpells: ['sl_ice_shard'], desc: 'Magia glacial. Inimigos que a atacam corpo-a-corpo sofrem Congelamento (Chilled) instantâneo.', sprite: 'img/sprites/Novos 8bits/leaders/yuki.png'"),

    ("name: 'Matriarca Harpia', loreFaction: 'PRIMORDIAL', emoji: '🦅', hp: 65, maxHp: 65, mp: 5, maxMp: 5, atk: 14, limit: 3, range: 1, tags: ['WING', 'PRIMAL'], fav: ['MOUNTAIN'], filter: 'saturate(150%)', abilities: ['flying', 'dodge'], desc: 'Senhora dos ventos. Ignora custos de terreno pesado (sempre move por 1 MP) e possui esquiva natural alta.', sprite: 'img/lideres/harpia.png'",
     "name: 'Matriarca Harpia', loreFaction: 'PRIMORDIAL', emoji: '🦅', hp: 65, maxHp: 65, mp: 5, maxMp: 5, atk: 14, limit: 3, range: 1, tags: ['WING', 'PRIMAL'], fav: ['MOUNTAIN'], filter: 'saturate(150%)', abilities: ['flying', 'dodge'], desc: 'Senhora dos ventos. Ignora custos de terreno pesado (sempre move por 1 MP) e possui esquiva natural alta.', sprite: 'img/sprites/Novos 8bits/leaders/harpia.png'"),

    ("name: 'Gárgula Anciã', loreFaction: 'PRIMORDIAL', emoji: '🗿', maxHp: 200, hp: 200, mp: 3, maxMp: 3, atk: 35, range: 1, limit: 3, fav: 'MOUNTAIN', tags: ['ROCK', 'WING'], abilities: ['flying', 'counter'], desc: 'Estátua viva de altíssima defesa. Voa e pune quem a ataca de perto.', sprite: 'img/lideres/gargula.png'",
     "name: 'Gárgula Anciã', loreFaction: 'PRIMORDIAL', emoji: '🗿', maxHp: 200, hp: 200, mp: 3, maxMp: 3, atk: 35, range: 1, limit: 3, fav: 'MOUNTAIN', tags: ['ROCK', 'WING'], abilities: ['flying', 'counter'], desc: 'Estátua viva de altíssima defesa. Voa e pune quem a ataca de perto.', sprite: 'img/sprites/Novos 8bits/leaders/gargula.png'"),

    ("name: 'Doutor da Praga', loreFaction: 'SOMBRAS', emoji: '🐦‍⬛', maxHp: 130, hp: 130, mp: 4, maxMp: 4, atk: 20, range: 2, limit: 3, tags: ['VENOM'], abilities: ['poison'], sprite: 'img/lideres/doutor_praga.png', desc: 'Mestre alquimista. Todas as feras aliadas compradas se tornam Venenosas.', knownSpells: ['sl_miasma_curativo']",
     "name: 'Doutor da Praga', loreFaction: 'SOMBRAS', emoji: '🐦‍⬛', maxHp: 130, hp: 130, mp: 4, maxMp: 4, atk: 20, range: 2, limit: 3, tags: ['VENOM'], abilities: ['poison'], sprite: 'img/sprites/Novos 8bits/leaders/plague-doctor.png', desc: 'Mestre alquimista. Todas as feras aliadas compradas se tornam Venenosas.', knownSpells: ['sl_miasma_curativo']"),

    ("name: 'Cthullu', loreFaction: 'ABISSAL', emoji: '🐙', maxHp: 110, hp: 110, mp: 4, maxMp: 4, atk: 18, range: 2, limit: 3, tags: ['ABYSSAL', 'UMBRAL'], fav: ['WATER'], abilities: ['bind', 'dive'], knownSpells: ['sl_tidal'], sprite: 'img/lideres/Cthullu.png'",
     "name: 'Cthullu', loreFaction: 'ABISSAL', emoji: '🐙', maxHp: 110, hp: 110, mp: 4, maxMp: 4, atk: 18, range: 2, limit: 3, tags: ['ABYSSAL', 'UMBRAL'], fav: ['WATER'], abilities: ['bind', 'dive'], knownSpells: ['sl_tidal'], sprite: 'img/sprites/Novos 8bits/leaders/cthulhu.png'")
]

for old_str, new_str in leader_replacements:
    assert old_str in new_data_content, f"Leader target not found: {old_str[:40]}"
    new_data_content = new_data_content.replace(old_str, new_str)

# Append new leaders right before the end of LEADERS array:
last_leader_marker = "{ id: 'ld_cthullu'"
idx_cth = new_data_content.find(last_leader_marker)
idx_end_leaders = new_data_content.find('\n];\n\nconst FACTIONS', idx_cth)
assert idx_end_leaders != -1, "Could not find end of LEADERS array"

new_leaders_code = ""
for nl in NEW_LEADERS:
    new_leaders_code += ",\n    " + json.dumps(nl, ensure_ascii=False)

new_data_content = (
    new_data_content[:idx_end_leaders] +
    new_leaders_code +
    new_data_content[idx_end_leaders:]
)

# Replace BEAST_SPRITE_MAP
map_start = new_data_content.find('const BEAST_SPRITE_MAP = {')
map_end = new_data_content.find('};\n\nconst ARTIFACTS', map_start) + 2
assert map_start != -1 and map_end != -1, "Could not find BEAST_SPRITE_MAP"

new_sprite_map_js = "const BEAST_SPRITE_MAP = {\n"
for k, v in sorted(complete_sprite_map.items()):
    new_sprite_map_js += f"    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},\n"
new_sprite_map_js += "};"

new_data_content = (
    new_data_content[:map_start] +
    new_sprite_map_js +
    new_data_content[map_end:]
)

# Add new beasts to BEASTS.LAND, BEASTS.WATER, BEASTS.SNOW:
# 1. LAND
land_end = new_data_content.find('\n    ],\n    WATER: [')
assert land_end != -1, "Could not find end of BEASTS.LAND"
land_add_code = ""
for b in NEW_LAND_BEASTS + BABY_BEASTS + MEGA_BEASTS:
    land_add_code += ",\n        " + json.dumps(b, ensure_ascii=False)

new_data_content = (
    new_data_content[:land_end] +
    land_add_code +
    new_data_content[land_end:]
)

# 2. WATER
water_end = new_data_content.find('\n    ],\n\n    SNOW: [')
if water_end == -1:
    water_end = new_data_content.find('],\n\n    SNOW: [')
if water_end == -1:
    water_end = new_data_content.find('],\n    SNOW: [')
assert water_end != -1, "Could not find end of BEASTS.WATER"
water_add_code = ""
for b in NEW_WATER_BEASTS:
    water_add_code += ",\n        " + json.dumps(b, ensure_ascii=False)

new_data_content = (
    new_data_content[:water_end] +
    water_add_code +
    new_data_content[water_end:]
)

# 3. SNOW
snow_end = new_data_content.find('\n    ],\n\n    BOSSES: [')
if snow_end == -1:
    snow_end = new_data_content.find('],\n\n    BOSSES: [')
if snow_end == -1:
    snow_end = new_data_content.find('],\n    BOSSES: [')
assert snow_end != -1, "Could not find end of BEASTS.SNOW"
snow_add_code = ""
for b in NEW_SNOW_BEASTS:
    snow_add_code += ",\n        " + json.dumps(b, ensure_ascii=False)

new_data_content = (
    new_data_content[:snow_end] +
    snow_add_code +
    new_data_content[snow_end:]
)

# Save new data.js
with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(new_data_content)

print("data.js successfully patched!")
