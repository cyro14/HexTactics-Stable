# Script to map all units and apply clean integration
import os, json

DAY_NIGHT_REGISTRY = {
    'Boto': {
        'day': 'img/sprites/Novos 8bits/units/boto-dia.png',
        'night': 'img/sprites/Novos 8bits/units/boto-night.png'
    },
    'Rei Bárbaro': {
        'day': 'img/sprites/Novos 8bits/leaders/human-king-dia.png',
        'night': 'img/sprites/Novos 8bits/leaders/ogre-king-noite.png'
    },
    'Rei Humano': {
        'day': 'img/sprites/Novos 8bits/leaders/human-king-dia.png',
        'night': 'img/sprites/Novos 8bits/leaders/ogre-king-noite.png'
    }
}

# Unit evolution sprites dictionary:
# Key is unit base name, value is dict of level -> sprite path
EVO_SPRITES_REGISTRY = {
    'Morcego': {
        1: 'img/sprites/Novos 8bits/units/bat.png',
        2: 'img/sprites/Novos 8bits/units/bat (2).png',
        3: 'img/sprites/Novos 8bits/units/blood-bat.png'
    },
    'Urso': {
        1: 'img/sprites/Novos 8bits/units/bear.png',
        2: 'img/sprites/Novos 8bits/units/bear (2).png',
        3: 'img/sprites/Novos 8bits/boss/werebear.png'
    },
    'Corvo': {
        1: 'img/sprites/Novos 8bits/units/crow.png',
        2: 'img/sprites/Novos 8bits/units/crow-2.png'
    },
    'Coruja Umbral': {
        1: 'img/sprites/Novos 8bits/units/coruja-umbral.png',
        2: 'img/sprites/Novos 8bits/units/coruja-umbral-2.png'
    },
    'Porco-Espinho Elétrico': {
        1: 'img/sprites/Novos 8bits/units/eletric-hedgehog.png',
        2: 'img/sprites/Novos 8bits/units/eletric-hedgeho-2.png'
    },
    'Raposa': {
        1: 'img/sprites/Novos 8bits/units/fox.png',
        2: 'img/sprites/Novos 8bits/units/firefox-2.png',
        3: 'img/sprites/Novos 8bits/units/kitsune.png'
    },
    'Sapo': {
        1: 'img/sprites/Novos 8bits/units/frog.png',
        2: 'img/sprites/Novos 8bits/units/frog-2.png',
        3: 'img/sprites/Novos 8bits/units/winged-frog.png'
    },
    'Gatuno': {
        1: 'img/sprites/Novos 8bits/units/gatuno.png',
        2: 'img/sprites/Novos 8bits/units/gatuno-2.png'
    },
    'Rato': {
        1: 'img/sprites/Novos 8bits/units/giant rat.png',
        2: 'img/sprites/Novos 8bits/units/giant-rat-2.png',
        3: 'img/sprites/Novos 8bits/boss/ratking.png'
    },
    'Hotweiler': {
        0: 'img/sprites/Novos 8bits/baby/baby-hotweiler.png',
        1: 'img/sprites/Novos 8bits/units/hotweiler.png',
        2: 'img/sprites/Novos 8bits/units/hotweiler-2.png'
    },
    'Cão Infernal': {
        1: 'img/sprites/Novos 8bits/units/hotweiler.png',
        2: 'img/sprites/Novos 8bits/units/hotweiler-2.png'
    },
    'Javali': {
        1: 'img/sprites/Novos 8bits/units/javali.png',
        2: 'img/sprites/Novos 8bits/units/javali-2.png',
        3: 'img/sprites/Novos 8bits/units/javali-3.png'
    },
    'Leão': {
        1: 'img/sprites/Novos 8bits/units/lion.png',
        2: 'img/sprites/Novos 8bits/units/lion-2.png',
        3: 'img/sprites/Novos 8bits/units/lion-3.png'
    },
    'Leão Selvagem': {
        1: 'img/sprites/Novos 8bits/units/lion.png',
        2: 'img/sprites/Novos 8bits/units/lion-2.png',
        3: 'img/sprites/Novos 8bits/units/lion-3.png'
    },
    'Lagarto': {
        1: 'img/sprites/Novos 8bits/units/lizard.png',
        2: 'img/sprites/Novos 8bits/units/lizard-2.png',
        3: 'img/sprites/Novos 8bits/boss/lizard-3.png'
    },
    'Lagarto Escarlate': {
        1: 'img/sprites/Novos 8bits/units/lizard.png',
        2: 'img/sprites/Novos 8bits/units/lizard-2.png',
        3: 'img/sprites/Novos 8bits/boss/lizard-3.png'
    },
    'Macaco': {
        1: 'img/sprites/Novos 8bits/units/monkey.png',
        2: 'img/sprites/Novos 8bits/units/monkey-2.png',
        3: 'img/sprites/Novos 8bits/units/monkey-3.png'
    },
    'Papabard': {
        1: 'img/sprites/Novos 8bits/units/papabard.png',
        2: 'img/sprites/Novos 8bits/units/papabard-2.png'
    },
    'Pinguim': {
        1: 'img/sprites/Novos 8bits/units/penguin.png',
        2: 'img/sprites/Novos 8bits/units/penguin-2.png',
        3: 'img/sprites/Novos 8bits/units/penguin-3.png'
    },
    'Escorpião': {
        1: 'img/sprites/Novos 8bits/units/scorpion.png',
        2: 'img/sprites/Novos 8bits/units/scorpion-2.png'
    },
    'Tubarão': {
        1: 'img/sprites/Novos 8bits/units/shark.png',
        2: 'img/sprites/Novos 8bits/units/shark-2.png',
        3: 'img/sprites/Novos 8bits/units/zombie-shark.png'
    },
    'Trent': {
        0: 'img/sprites/Novos 8bits/baby/baby-trent.png',
        1: 'img/sprites/Novos 8bits/units/trent.png',
        2: 'img/sprites/Novos 8bits/boss/trent-2.png'
    },
    'Tuiuiú': {
        0: 'img/sprites/Novos 8bits/baby/baby-tuiuiu.png',
        1: 'img/sprites/Novos 8bits/units/tuiuiu.png',
        2: 'img/sprites/Novos 8bits/units/tuiuiu-2.png'
    },
    'Tuiuiú Guardião': {
        1: 'img/sprites/Novos 8bits/units/tuiuiu.png',
        2: 'img/sprites/Novos 8bits/units/tuiuiu-2.png'
    },
    'Tartaruga': {
        0: 'img/sprites/Novos 8bits/baby/baby-turtle.png',
        1: 'img/sprites/Novos 8bits/units/turtle.png',
        2: 'img/sprites/Novos 8bits/units/turtle-earth.png',
        3: 'img/sprites/Novos 8bits/units/turtle-3.png'
    },
    'Baleia': {
        0: 'img/sprites/Novos 8bits/baby/baby-whale.png',
        1: 'img/sprites/Novos 8bits/units/whale.png',
        2: 'img/sprites/Novos 8bits/boss/earth-whale.png',
        3: 'img/sprites/Novos 8bits/boss/cosmic-whale.png'
    },
    'Zumbi': {
        1: 'img/sprites/Novos 8bits/units/zombie.png',
        2: 'img/sprites/Novos 8bits/units/zombie-2.png'
    },
    'Zumbi Ancião': {
        1: 'img/sprites/Novos 8bits/units/zombie.png',
        2: 'img/sprites/Novos 8bits/units/zombie-2.png'
    },
    'Banshee': {
        0: 'img/sprites/Novos 8bits/baby/baby-banshee.png',
        1: 'img/sprites/Novos 8bits/units/banshe.png',
        2: 'img/sprites/Novos 8bits/units/banshee-2.png'
    },
    'Centopeia Metálica': {
        0: 'img/sprites/Novos 8bits/baby/baby-centopeia-metalica.png',
        1: 'img/boss/centopeia-metalica.png',
        2: 'img/sprites/Novos 8bits/boss/centopeia-metalica-3.png'
    },
    'Leviatã': {
        0: 'img/sprites/Novos 8bits/boss/baby-leviatan.png',
        1: 'img/boss/leviata.png',
        2: 'img/sprites/Novos 8bits/boss/leviatan-2.png',
        3: 'img/sprites/Novos 8bits/boss/leviatan-3.png'
    },
    'Cuca': {
        1: 'img/sprites/Novos 8bits/boss/cuca.png',
        2: 'img/sprites/Novos 8bits/boss/cuca-2.png'
    },
    'Capelobo': {
        1: 'img/sprites/Novos 8bits/boss/capelobo.png',
        2: 'img/sprites/Novos 8bits/boss/capelobo-2.png'
    },
    'Bigfoot': {
        1: 'img/sprites/Novos 8bits/units/bigfoot.png',
        2: 'img/sprites/Novos 8bits/boss/bigfoot-2.png'
    },
    'Grifo': {
        1: 'img/sprites/Novos 8bits/units/grifo.png',
        2: 'img/sprites/Novos 8bits/boss/grifo-2.png'
    },
    'Ifrit': {
        1: 'img/sprites/Novos 8bits/boss/ifrit.png',
        2: 'img/sprites/Novos 8bits/boss/ifrit-2.png'
    },
    'Mapinguari': {
        1: 'img/sprites/Novos 8bits/boss/mapinguari.png',
        2: 'img/sprites/Novos 8bits/boss/mapinguari-2.png'
    },
    'Mosassauro': {
        1: 'img/sprites/Novos 8bits/units/mosassauro.png',
        2: 'img/sprites/Novos 8bits/boss/mosassauro-2.png'
    },
    'Nessie': {
        1: 'img/sprites/Novos 8bits/boss/ness.png',
        2: 'img/sprites/Novos 8bits/boss/ness-2.png'
    },
    'Verme da Areia': {
        1: 'img/sprites/Novos 8bits/boss/sand-worm.png',
        2: 'img/sprites/Novos 8bits/boss/sand-worm-2.png'
    },
    'Verme de Areia': {
        1: 'img/sprites/Novos 8bits/boss/sand-worm.png',
        2: 'img/sprites/Novos 8bits/boss/sand-worm-2.png'
    },
    'Treeslender': {
        1: 'img/sprites/Novos 8bits/boss/treeslender.png',
        2: 'img/sprites/Novos 8bits/boss/treeslender-2.png',
        3: 'img/sprites/Novos 8bits/boss/treeslender-3.png'
    },
    'Wendigo': {
        1: 'img/sprites/Novos 8bits/boss/wendigo.png',
        2: 'img/sprites/Novos 8bits/boss/wendigo-2.png'
    },
    'Yeti': {
        1: 'img/sprites/Novos 8bits/boss/yeti.png',
        2: 'img/sprites/Novos 8bits/boss/yeti-2.png'
    },
    'Yeti Atirador': {
        1: 'img/sprites/Novos 8bits/boss/yeti.png',
        2: 'img/sprites/Novos 8bits/boss/yeti-2.png'
    },
    'Yurei': {
        1: 'img/sprites/Novos 8bits/boss/yurei.png',
        2: 'img/sprites/Novos 8bits/boss/yurei-2.png'
    },
    'Dragão Sombrio': {
        1: 'img/sprites/Novos 8bits/boss/dark-dragon.png',
        2: 'img/sprites/Novos 8bits/boss/dark-dragon-2.png',
        3: 'img/sprites/Novos 8bits/boss/dark-dragon-3.png'
    },
    'Chefe Orc': {
        1: 'img/sprites/Novos 8bits/leaders/orc.png',
        2: 'img/sprites/Novos 8bits/leaders/orc-2.png'
    },
    'Necromante': {
        1: 'img/sprites/Novos 8bits/leaders/necromante.png',
        2: 'img/sprites/Novos 8bits/leaders/necromante-2.png'
    },
    'Arqueira': {
        1: 'img/sprites/Novos 8bits/leaders/darkelf-archer.png',
        2: 'img/sprites/Novos 8bits/leaders/darkelf-archer-2.png'
    },
    'Bruxa': {
        1: 'img/sprites/Novos 8bits/leaders/witch.png',
        2: 'img/sprites/Novos 8bits/leaders/witch-2.png'
    },
    'Sereia': {
        1: 'img/sprites/Novos 8bits/leaders/siren.png',
        2: 'img/sprites/Novos 8bits/leaders/siren-2.png'
    },
    'Lord Vampiro': {
        1: 'img/sprites/Novos 8bits/leaders/vampire.png',
        2: 'img/sprites/Novos 8bits/leaders/vampire-2.png'
    },
    'Anubis': {
        1: 'img/sprites/Novos 8bits/leaders/anubis.png'
    },
    'Centauro Espectral': {
        1: 'img/sprites/Novos 8bits/leaders/mystic-centaur.png',
        2: 'img/sprites/Novos 8bits/leaders/mystic-centaur-2.png'
    },
    'Matriarca Harpia': {
        1: 'img/sprites/Novos 8bits/leaders/harpia.png',
        2: 'img/sprites/Novos 8bits/leaders/harpia-2.png'
    },
    'Gárgula Anciã': {
        1: 'img/sprites/Novos 8bits/leaders/gargula.png',
        2: 'img/sprites/Novos 8bits/leaders/gargula-2.png'
    },
    'Doutor da Praga': {
        1: 'img/sprites/Novos 8bits/leaders/plague-doctor.png',
        2: 'img/sprites/Novos 8bits/leaders/plague-doctor-2.png'
    },
    'Cthullu': {
        1: 'img/sprites/Novos 8bits/leaders/cthulhu.png'
    },
    'T-Rex': {
        1: 'img/sprites/Novos 8bits/leaders/Rock-rex.png',
        2: 'img/sprites/Novos 8bits/leaders/Rock-rex-2.png'
    },
    'Rainha do Gelo': {
        1: 'img/sprites/Novos 8bits/leaders/yuki.png',
        2: 'img/sprites/Novos 8bits/leaders/yuki-2.png',
        3: 'img/sprites/Novos 8bits/leaders/yuki-3.png'
    }
}

print("Registries ready.")
