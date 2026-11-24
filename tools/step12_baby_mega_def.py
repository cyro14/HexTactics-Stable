import os, sys, json, re

# Baby beasts definitions
BABY_BEASTS = [
    { 'e': '🐣', 'name': 'Filhote Aquático', 'hp': 20, 'atk': 7, 'mp': 4, 'range': 1, 'abilities': ['dive'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (38).png', 'tags': ['ABYSSAL'], 'fav': ['WATER'] },
    { 'e': '🐣', 'name': 'Filhote Terrestre', 'hp': 25, 'atk': 6, 'mp': 4, 'range': 1, 'abilities': ['counter'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (39).png', 'tags': ['ROCK'], 'fav': ['PLAINS'] },
    { 'e': '🐣', 'name': 'Filhote Alado', 'hp': 20, 'atk': 8, 'mp': 5, 'range': 1, 'abilities': ['flying'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (42).png', 'tags': ['WING'], 'fav': ['FOREST'] },
    { 'e': '🐣', 'name': 'Filhote Silvestre', 'hp': 22, 'atk': 7, 'mp': 4, 'range': 1, 'abilities': ['dodge'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (43).png', 'tags': ['SILVESTRE'], 'fav': ['FOREST'] },
    { 'e': '🐣', 'name': 'Filhote Elétrico', 'hp': 20, 'atk': 8, 'mp': 5, 'range': 1, 'abilities': ['electric'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (44).png', 'tags': ['ELECTRIC'], 'fav': ['MOUNTAIN'] },
    { 'e': '🐣', 'name': 'Filhote Gélido', 'hp': 24, 'atk': 7, 'mp': 4, 'range': 1, 'abilities': ['freeze'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (45).png', 'tags': ['ICE'], 'fav': ['SNOW'] },
    { 'e': '🐣', 'name': 'Filhote Sombrio', 'hp': 22, 'atk': 8, 'mp': 4, 'range': 1, 'abilities': ['lifesteal'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (46).png', 'tags': ['UMBRAL'], 'fav': ['SWAMP'] },
    { 'e': '🐣', 'name': 'Filhote Sagrado', 'hp': 24, 'atk': 7, 'mp': 4, 'range': 1, 'abilities': ['crystal_skin'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/pokemon-downgrade-baby (47).png', 'tags': ['CELESTIAL'], 'fav': ['PLAINS'] },
    { 'e': '👻', 'name': 'Filhote de Banshee', 'hp': 22, 'atk': 9, 'mp': 4, 'range': 1, 'abilities': ['dodge'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-banshee.png', 'tags': ['UMBRAL', 'MYSTIC'], 'fav': ['SWAMP'] },
    { 'e': '🪲', 'name': 'Filhote de Centopeia', 'hp': 30, 'atk': 8, 'mp': 3, 'range': 1, 'abilities': ['carapace'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-centopeia-metalica.png', 'tags': ['CARAPACE', 'VENOM'], 'fav': ['PLAINS'] },
    { 'e': '🌳', 'name': 'Filhote de Trent', 'hp': 35, 'atk': 7, 'mp': 2, 'range': 1, 'abilities': ['carapace'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-trent.png', 'tags': ['SILVESTRE', 'CARAPACE'], 'fav': ['FOREST'] },
    { 'e': '🦅', 'name': 'Filhote de Tuiuiú', 'hp': 25, 'atk': 8, 'mp': 5, 'range': 1, 'abilities': ['flying'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-tuiuiu.png', 'tags': ['WING', 'SILVESTRE'], 'fav': ['SWAMP'] },
    { 'e': '🐢', 'name': 'Filhote de Tartaruga', 'hp': 35, 'atk': 5, 'mp': 2, 'range': 1, 'abilities': ['carapace'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-turtle.png', 'tags': ['ROCK', 'PRIMAL'], 'fav': ['WATER', 'PLAINS'] },
    { 'e': '🐋', 'name': 'Filhote de Baleia', 'hp': 40, 'atk': 7, 'mp': 3, 'range': 1, 'abilities': ['dive'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/baby/baby-whale.png', 'tags': ['ABYSSAL', 'PRIMAL'], 'fav': ['WATER'] },
    { 'e': '🐉', 'name': 'Filhote de Leviatã', 'hp': 45, 'atk': 10, 'mp': 3, 'range': 1, 'abilities': ['dive'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/baby-leviatan.png', 'tags': ['ABYSSAL', 'MYSTIC'], 'fav': ['WATER'] },
]

# Elite Mega evolutions
MEGA_BEASTS = [
    { 'e': '☀️', 'name': 'Mega Besta Solar', 'hp': 90, 'atk': 22, 'mp': 5, 'range': 1, 'abilities': ['burn', 'swift'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (4).png', 'tags': ['FIRE', 'CELESTIAL'], 'fav': ['PLAINS', 'ASHES'] },
    { 'e': '🌙', 'name': 'Mega Besta Lunar', 'hp': 85, 'atk': 20, 'mp': 5, 'range': 2, 'abilities': ['frost_armor', 'lifesteal'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (5).png', 'tags': ['ICE', 'UMBRAL'], 'fav': ['SNOW', 'FOREST'] },
    { 'e': '⛰️', 'name': 'Mega Besta Terrestre', 'hp': 110, 'atk': 20, 'mp': 3, 'range': 1, 'abilities': ['carapace', 'counter'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (9).png', 'tags': ['ROCK', 'CARAPACE'], 'fav': ['MOUNTAIN'] },
    { 'e': '🌌', 'name': 'Mega Besta Cósmica', 'hp': 100, 'atk': 24, 'mp': 5, 'range': 2, 'abilities': ['crystal_skin', 'electric'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (42).png', 'tags': ['CELESTIAL', 'MYSTIC'], 'fav': ['PLAINS'] },
    { 'e': '🗿', 'name': 'Entidade Ancestral I', 'hp': 130, 'atk': 25, 'mp': 3, 'range': 1, 'abilities': ['pierce', 'carapace'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0017.png', 'tags': ['PRIMAL', 'ROCK'], 'fav': ['MOUNTAIN'] },
    { 'e': '🗿', 'name': 'Entidade Ancestral II', 'hp': 125, 'atk': 26, 'mp': 4, 'range': 1, 'abilities': ['counter', 'burn'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0019.png', 'tags': ['FIRE', 'PRIMAL'], 'fav': ['ASHES'] },
    { 'e': '🗿', 'name': 'Entidade Ancestral III', 'hp': 120, 'atk': 27, 'mp': 4, 'range': 2, 'abilities': ['flying', 'electric'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0020.png', 'tags': ['ELECTRIC', 'WING'], 'fav': ['PLAINS'] },
    { 'e': '🗿', 'name': 'Entidade Ancestral IV', 'hp': 140, 'atk': 28, 'mp': 3, 'range': 1, 'abilities': ['lifesteal', 'bind'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0021.png', 'tags': ['UMBRAL', 'MYSTIC'], 'fav': ['SWAMP'] },
]

print("Baby beasts:", len(BABY_BEASTS))
print("Mega beasts:", len(MEGA_BEASTS))
