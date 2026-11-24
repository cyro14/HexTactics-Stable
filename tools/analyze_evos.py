import os, re, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

units_files = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/units')))
boss_files = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/boss')))
leaders_files = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/leaders')))
baby_files = sorted(os.listdir(os.path.join(ROOT, 'img/sprites/Novos 8bits/baby')))

# Let's inspect EVOS mapping:
# For units:
# bat: bat.png (lvl 1), bat (2).png (lvl 2)
# bear: bear.png (lvl 1), bear (2).png (lvl 2)
# coruja-umbral: coruja-umbral.png (lvl 1), coruja-umbral-2.png (lvl 2)
# crow: crow.png (lvl 1), crow-2.png (lvl 2)
# eletric-hedgehog: eletric-hedgehog.png (lvl 1), eletric-hedgeho-2.png (lvl 2)
# fox: fox.png (lvl 1), firefox-2.png (lvl 2)
# frog: frog.png (lvl 1), frog-2.png (lvl 2)
# frog-warrior: frog-warrior.png (lvl 1), frog-warrior-2.png (lvl 2)
# gatuno: gatuno.png (lvl 1), gatuno-2.png (lvl 2)
# giant rat: giant rat.png (lvl 1), giant-rat-2.png (lvl 2)
# hotweiler: baby-hotweiler.png (baby), hotweiler.png (lvl 1), hotweiler-2.png (lvl 2)
# javali: javali.png (lvl 1), javali-2.png (lvl 2), javali-3.png (lvl 3)
# lion: lion.png (lvl 1), lion-2.png (lvl 2), lion-3.png (lvl 3)
# lizard: lizard.png (lvl 1), lizard-2.png (lvl 2), lizard-3.png (lvl 3)
# monkey: monkey.png (lvl 1), monkey-2.png (lvl 2), monkey-3.png (lvl 3)
# papabard: papabard.png (lvl 1), papabard-2.png (lvl 2)
# penguin: penguin.png (lvl 1), penguin-2.png (lvl 2), penguin-3.png (lvl 3)
# scorpion: scorpion.png (lvl 1), scorpion-2.png (lvl 2)
# shark: shark.png (lvl 1), shark-2.png (lvl 2)
# trent: baby-trent.png (baby), trent.png (lvl 1), trent-2.png (lvl 2)
# tuiuiu: baby-tuiuiu.png (baby), tuiuiu.png (lvl 1), tuiuiu-2.png (lvl 2)
# turtle: baby-turtle.png (baby), turtle.png (lvl 1), turtle-3.png (lvl 3)
# zombie: zombie.png (lvl 1), zombie-2.png (lvl 2)
print("Units evos analyzed.")
