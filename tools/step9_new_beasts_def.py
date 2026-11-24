import os, sys, json, re

# Let's define the new beasts to add into BEASTS in data.js:
# New LAND beasts:
NEW_LAND_BEASTS = [
    { 'e': '🦔', 'name': 'Ouriço Elétrico', 'hp': 35, 'atk': 12, 'mp': 4, 'range': 1, 'abilities': ['counter', 'electric'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/eletric-hedgehog.png', 'tags': ['CARAPACE', 'ELECTRIC'], 'fav': ['PLAINS'] },
    { 'e': '🐱', 'name': 'Gatuno', 'hp': 32, 'atk': 14, 'mp': 5, 'range': 1, 'abilities': ['hit_run', 'dodge'], 'minLevel': 1, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/gatuno.png', 'tags': ['STALKER', 'SILVESTRE'], 'fav': ['FOREST'] },
    { 'e': '🦔', 'name': 'Tamanduá', 'hp': 42, 'atk': 13, 'mp': 3, 'range': 1, 'abilities': ['carapace', 'counter'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/tamandua.png', 'tags': ['SILVESTRE', 'CARAPACE'], 'fav': ['FOREST', 'PLAINS'] },
    { 'e': '🦌', 'name': 'Sátiro', 'hp': 44, 'atk': 15, 'mp': 5, 'range': 1, 'abilities': ['swift'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/satiro.png', 'tags': ['SILVESTRE', 'MYSTIC'], 'fav': ['FOREST'] },
    { 'e': '🌳', 'name': 'Trent', 'hp': 85, 'atk': 14, 'mp': 2, 'range': 1, 'abilities': ['carapace', 'bind'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/trent.png', 'tags': ['SILVESTRE', 'CARAPACE'], 'fav': ['FOREST'] },
    { 'e': '💀', 'name': 'Morto-Vivo de Eldorado', 'hp': 50, 'atk': 16, 'mp': 3, 'range': 1, 'abilities': ['counter', 'lifesteal'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/eldorado-undead.png', 'tags': ['UMBRAL', 'SAND'], 'fav': ['DESERT'] },
    { 'e': '🦉', 'name': 'Coruja Lunar', 'hp': 38, 'atk': 16, 'mp': 5, 'range': 2, 'abilities': ['flying', 'frost_armor'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/moon-owl.png', 'tags': ['ICE', 'WING', 'CELESTIAL'], 'fav': ['FOREST', 'SNOW'] },
    { 'e': '🦇', 'name': 'Dragão-Morcego', 'hp': 52, 'atk': 17, 'mp': 5, 'range': 1, 'abilities': ['flying', 'lifesteal'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/bat-dragon.png', 'tags': ['WING', 'UMBRAL'], 'fav': ['MOUNTAIN', 'ASHES'] },
    { 'e': '🧌', 'name': 'Bigfoot', 'hp': 80, 'atk': 18, 'mp': 3, 'range': 1, 'abilities': ['stun'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/bigfoot.png', 'tags': ['PRIMAL', 'SILVESTRE'], 'fav': ['FOREST', 'MOUNTAIN'] },
    { 'e': '🦇', 'name': 'Morcego Sanguinário', 'hp': 36, 'atk': 15, 'mp': 5, 'range': 1, 'abilities': ['flying', 'lifesteal'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/blood-bat.png', 'tags': ['WING', 'UMBRAL'], 'fav': ['FOREST', 'ASHES'] },
    { 'e': '🐉', 'name': 'Dragão Sombrio', 'hp': 110, 'atk': 24, 'mp': 4, 'range': 2, 'abilities': ['flying', 'lifesteal'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/dark-dragon.png', 'tags': ['UMBRAL', 'WING'], 'fav': ['ASHES', 'MOUNTAIN'] },
    { 'e': '🐉', 'name': 'Dragão da Terra', 'hp': 120, 'atk': 22, 'mp': 3, 'range': 1, 'abilities': ['carapace', 'pierce'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/earth-dragon.png', 'tags': ['ROCK', 'PRIMAL'], 'fav': ['MOUNTAIN'] },
    { 'e': '🐉', 'name': 'Dragão de Fogo', 'hp': 105, 'atk': 25, 'mp': 4, 'range': 2, 'abilities': ['flying', 'burn'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/fire-dragon.png', 'tags': ['FIRE', 'WING'], 'fav': ['ASHES', 'MOUNTAIN'] },
    { 'e': '🐉', 'name': 'Dragão da Luz', 'hp': 100, 'atk': 23, 'mp': 5, 'range': 2, 'abilities': ['flying', 'electric'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/light-dragon.png', 'tags': ['CELESTIAL', 'WING'], 'fav': ['PLAINS'] },
    { 'e': '🐉', 'name': 'Dragão Esqueleto', 'hp': 95, 'atk': 22, 'mp': 4, 'range': 1, 'abilities': ['flying', 'counter'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/eskeleton-dragon.png', 'tags': ['UMBRAL', 'WING'], 'fav': ['ASHES', 'SWAMP'] },
    { 'e': '🦕', 'name': 'Brontossauro', 'hp': 130, 'atk': 18, 'mp': 2, 'range': 1, 'abilities': ['carapace', 'stun'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/mokele-mbembe.png', 'tags': ['PRIMAL', 'ROCK'], 'fav': ['FOREST', 'SWAMP'] },
    { 'e': '🐯', 'name': 'Tigre Dente-de-Sabre', 'hp': 75, 'atk': 22, 'mp': 5, 'range': 1, 'abilities': ['swift', 'dodge'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/dente-sabre.png', 'tags': ['STALKER', 'PRIMAL'], 'fav': ['MOUNTAIN', 'SNOW'] },
    { 'e': '🦁', 'name': 'Manticora', 'hp': 85, 'atk': 21, 'mp': 4, 'range': 2, 'abilities': ['flying', 'poison'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/manticore.png', 'tags': ['VENOM', 'WING', 'SAND'], 'fav': ['DESERT', 'MOUNTAIN'] },
    { 'e': '🦘', 'name': 'Canguru Rochoso', 'hp': 70, 'atk': 19, 'mp': 5, 'range': 1, 'abilities': ['dodge', 'counter'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/rock-canguru.png', 'tags': ['ROCK', 'SAND'], 'fav': ['MOUNTAIN', 'DESERT'] },
    { 'e': '👻', 'name': 'Treeslender', 'hp': 90, 'atk': 20, 'mp': 4, 'range': 2, 'abilities': ['bind', 'camouflage'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/treeslender.png', 'tags': ['UMBRAL', 'SILVESTRE'], 'fav': ['FOREST'] },
    { 'e': '🐻', 'name': 'Urso-Coruja', 'hp': 85, 'atk': 20, 'mp': 3, 'range': 1, 'abilities': ['pierce', 'counter'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/urso-coruja.png', 'tags': ['PRIMAL', 'SILVESTRE'], 'fav': ['FOREST'] },
    { 'e': '👑', 'name': 'Rei dos Ratos', 'hp': 80, 'atk': 18, 'mp': 5, 'range': 1, 'abilities': ['leadership', 'poison'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/ratking.png', 'tags': ['STALKER', 'VENOM'], 'fav': ['SWAMP', 'PLAINS'] },
    { 'e': '🪨', 'name': 'Golem Rochoso Zumbi', 'hp': 110, 'atk': 19, 'mp': 2, 'range': 1, 'abilities': ['carapace', 'lifesteal'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/zombie-rock-golem.png', 'tags': ['ROCK', 'UMBRAL'], 'fav': ['MOUNTAIN', 'ASHES'] },
    { 'e': '🦧', 'name': 'Capelobo', 'hp': 85, 'atk': 22, 'mp': 4, 'range': 1, 'abilities': ['stun', 'lifesteal'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/capelobo.png', 'tags': ['UMBRAL', 'PRIMAL'], 'fav': ['FOREST'] },
    { 'e': '🦧', 'name': 'Mapinguari', 'hp': 120, 'atk': 24, 'mp': 2, 'range': 1, 'abilities': ['carapace', 'stun'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/mapinguari.png', 'tags': ['PRIMAL', 'SILVESTRE'], 'fav': ['FOREST'] },
    { 'e': '🐍', 'name': 'Apófis', 'hp': 140, 'atk': 26, 'mp': 4, 'range': 2, 'abilities': ['poison', 'bind'], 'minLevel': 5, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/apophis.png', 'tags': ['SAND', 'VENOM', 'UMBRAL'], 'fav': ['DESERT'] },
    { 'e': '🪱', 'name': 'Verme da Areia', 'hp': 100, 'atk': 24, 'mp': 3, 'range': 1, 'abilities': ['camouflage', 'stun'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/sand-worm.png', 'tags': ['SAND', 'STALKER'], 'fav': ['DESERT'] },
    { 'e': '🔥', 'name': 'Lagarto de Fogo', 'hp': 65, 'atk': 18, 'mp': 4, 'range': 1, 'abilities': ['burn'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/fire-lizard.png', 'tags': ['FIRE', 'CARAPACE'], 'fav': ['ASHES', 'MOUNTAIN'] },
    { 'e': '🦅', 'name': 'Fenghuang', 'hp': 80, 'atk': 22, 'mp': 5, 'range': 2, 'abilities': ['flying', 'electric', 'burn'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/fenghuang-tevi.png', 'tags': ['CELESTIAL', 'FIRE', 'WING'], 'fav': ['PLAINS', 'MOUNTAIN'] },
    { 'e': '🦅', 'name': 'Grifo-Coruja', 'hp': 75, 'atk': 20, 'mp': 5, 'range': 1, 'abilities': ['flying', 'dodge'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/grifo-coruja.png', 'tags': ['WING', 'SILVESTRE'], 'fav': ['MOUNTAIN', 'FOREST'] },
    { 'e': '🐂', 'name': 'Minotauro', 'hp': 95, 'atk': 23, 'mp': 3, 'range': 1, 'abilities': ['corte_amplo'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/minotauro.png', 'tags': ['PRIMAL', 'ROCK'], 'fav': ['MOUNTAIN', 'PLAINS'] },
    { 'e': '👻', 'name': 'Yurei', 'hp': 70, 'atk': 21, 'mp': 5, 'range': 2, 'abilities': ['dodge', 'bind'], 'minLevel': 4, 'filter:': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/yurei.png', 'tags': ['UMBRAL', 'MYSTIC'], 'fav': ['SWAMP', 'FOREST'] },
]

# New WATER beasts:
NEW_WATER_BEASTS = [
    { 'e': '🐬', 'name': 'Boto', 'hp': 50, 'atk': 15, 'mp': 5, 'range': 1, 'abilities': ['dive', 'swift'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/boto-dia.png', 'tags': ['ABYSSAL', 'MYSTIC'], 'fav': ['WATER'] },
    { 'e': '🐸', 'name': 'Sapo de Fogo', 'hp': 40, 'atk': 14, 'mp': 4, 'range': 1, 'abilities': ['burn', 'dive'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/fire-frog.png', 'tags': ['FIRE', 'ABYSSAL'], 'fav': ['WATER', 'ASHES'] },
    { 'e': '🐸', 'name': 'Sapo Fantasma', 'hp': 38, 'atk': 13, 'mp': 4, 'range': 1, 'abilities': ['dodge', 'dive'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/ghost-frog.png', 'tags': ['UMBRAL', 'ABYSSAL'], 'fav': ['WATER', 'SWAMP'] },
    { 'e': '🐸', 'name': 'Sapo Guerreiro', 'hp': 55, 'atk': 16, 'mp': 4, 'range': 1, 'abilities': ['counter', 'dive'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/frog-warrior.png', 'tags': ['ABYSSAL', 'PRIMAL'], 'fav': ['WATER'] },
    { 'e': '🧜‍♂️', 'name': 'Tritão', 'hp': 60, 'atk': 17, 'mp': 4, 'range': 1, 'abilities': ['dive', 'pierce'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/tritao.png', 'tags': ['ABYSSAL', 'SILVESTRE'], 'fav': ['WATER'] },
    { 'e': '🦕', 'name': 'Mosassauro', 'hp': 115, 'atk': 25, 'mp': 4, 'range': 1, 'abilities': ['dive', 'lifesteal'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/mosassauro.png', 'tags': ['ABYSSAL', 'PRIMAL'], 'fav': ['WATER'] },
    { 'e': '🦕', 'name': 'Nessie', 'hp': 100, 'atk': 22, 'mp': 4, 'range': 2, 'abilities': ['dive', 'bind'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/ness.png', 'tags': ['ABYSSAL', 'MYSTIC'], 'fav': ['WATER'] },
    { 'e': '🦈', 'name': 'Tubarão Zumbi', 'hp': 65, 'atk': 20, 'mp': 4, 'range': 1, 'abilities': ['dive', 'lifesteal'], 'minLevel': 3, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/zombie-shark.png', 'tags': ['ABYSSAL', 'UMBRAL'], 'fav': ['WATER'] },
]

# New SNOW beasts:
NEW_SNOW_BEASTS = [
    { 'e': '🦌', 'name': 'Cervo da Neve', 'hp': 42, 'atk': 12, 'mp': 5, 'range': 1, 'abilities': ['swift', 'frost_armor'], 'minLevel': 2, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/units/cervo-neve.png', 'tags': ['ICE', 'SILVESTRE'], 'fav': ['SNOW'] },
    { 'e': '🐉', 'name': 'Dragão do Gelo', 'hp': 115, 'atk': 24, 'mp': 4, 'range': 2, 'abilities': ['flying', 'freeze'], 'minLevel': 4, 'filter': 'none', 'sprite': 'img/sprites/Novos 8bits/boss/ice-dragon.png', 'tags': ['ICE', 'WING'], 'fav': ['SNOW', 'MOUNTAIN'] },
]

print("Defined additions: LAND:", len(NEW_LAND_BEASTS), "WATER:", len(NEW_WATER_BEASTS), "SNOW:", len(NEW_SNOW_BEASTS))
