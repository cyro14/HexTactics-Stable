import os, re, json

# Additional evos and mappings for remaining files:
ADDITIONAL_EVOS = {
    'Anjo': {
        1: 'img/sprites/Novos 8bits/leaders/angel.png',
        2: 'img/sprites/Novos 8bits/leaders/angel-2.png'
    },
    'Anjo Vingador': {
        1: 'img/sprites/Novos 8bits/leaders/angel.png',
        2: 'img/sprites/Novos 8bits/leaders/angel-2.png'
    },
    'Príncipe Elfo Sombrio': {
        1: 'img/sprites/Novos 8bits/leaders/darkelf-prince.png',
        2: 'img/sprites/Novos 8bits/leaders/darkelf-prince-2.png'
    },
    'Mago da Morte': {
        1: 'img/sprites/Novos 8bits/leaders/death-mage.png',
        2: 'img/sprites/Novos 8bits/leaders/death-mage-2.png',
        3: 'img/sprites/Novos 8bits/leaders/death-mage-3.png'
    },
    'Guerreiro Fantasma': {
        1: 'img/sprites/Novos 8bits/leaders/ghost-warrior.png',
        2: 'img/sprites/Novos 8bits/leaders/ghost-warrior-2.png',
        3: 'img/sprites/Novos 8bits/leaders/ghost-warrior-3.png'
    },
    'Caçador': {
        1: 'img/sprites/Novos 8bits/leaders/hunter.png',
        2: 'img/sprites/Novos 8bits/leaders/hunter-2.png'
    },
    'Medusa': {
        1: 'img/sprites/Novos 8bits/leaders/medusa.png',
        2: 'img/sprites/Novos 8bits/leaders/medusa-2.png'
    },
    'Súcubo': {
        1: 'img/sprites/Novos 8bits/leaders/succubus.png',
        2: 'img/sprites/Novos 8bits/leaders/succubus-2.png'
    },
    'Sapo Guerreiro': {
        1: 'img/sprites/Novos 8bits/units/frog-warrior.png',
        2: 'img/sprites/Novos 8bits/units/frog-warrior-2.png'
    },
    'Manticora': {
        1: 'img/sprites/Novos 8bits/boss/manticore.png',
        2: 'img/sprites/Novos 8bits/boss/manticora-2.png'
    },
    'Morto-Vivo de Eldorado': {
        1: 'img/sprites/Novos 8bits/units/eldorado-undead.png',
        2: 'img/sprites/Novos 8bits/leaders/eldourado-undead-2.png'
    },
    'Tigre': {
        1: 'img/sprites/Novos 8bits/units/tiger.png',
        2: 'img/sprites/Novos 8bits/units/white-tiger.png',
        3: 'img/sprites/Novos 8bits/boss/winged-tiger.png'
    },
    'Brontossauro': {
        1: 'img/sprites/Novos 8bits/boss/mokele-mbembe.png',
        2: 'img/sprites/Novos 8bits/boss/brachio-2.png'
    },
    'Dragão Esqueleto': {
        1: 'img/sprites/Novos 8bits/boss/eskeleton-dragon.png',
        2: 'img/sprites/Novos 8bits/boss/skeleton-dragon-2.png'
    }
}

# Single sprites (base form):
SINGLE_SPRITES = {
    'Arquimago': 'img/sprites/Novos 8bits/leaders/archemage.png',
    'Apófis': 'img/sprites/Novos 8bits/boss/apophis.png',
    'Aravata': 'img/sprites/Novos 8bits/boss/aravata.png',
    'Bake-Kujira': 'img/sprites/Novos 8bits/boss/bake-kujira.png',
    'Basilisco': 'img/sprites/Novos 8bits/boss/basilisco.png',
    'Dragão-Morcego': 'img/sprites/Novos 8bits/units/bat-dragon.png',
    'Bem-te-vi': 'img/sprites/Novos 8bits/units/bemtevi.png',
    'Boitatá': 'img/sprites/Novos 8bits/boss/boitata.png',
    'Canguru': 'img/sprites/Novos 8bits/units/canguru.png',
    'Cérbero': 'img/sprites/Novos 8bits/boss/cerberus.png',
    'Cerberus Sanguinário': 'img/sprites/Novos 8bits/boss/cerberus.png',
    'Cervo da Neve': 'img/sprites/Novos 8bits/units/cervo-neve.png',
    'Cervo': 'img/sprites/Novos 8bits/units/cervo.png',
    'Coruja Maga': 'img/sprites/Novos 8bits/boss/coruja-mage.png',
    'Tigre Dente-de-Sabre': 'img/sprites/Novos 8bits/boss/dente-sabre.png',
    'Dragão da Terra': 'img/sprites/Novos 8bits/boss/earth-dragon.png',
    'Rei Lich de Eldorado': 'img/sprites/Novos 8bits/boss/eldorado-lichking.png',
    'Elefante': 'img/sprites/Novos 8bits/units/elephant.png',
    'Arqueira Elfa': 'img/sprites/Novos 8bits/leaders/elf-archer-2.png',
    'Feiticeira': 'img/sprites/Novos 8bits/leaders/feiticeira.png',
    'Feiticeira do Fogo': 'img/sprites/Novos 8bits/leaders/feiticeira-fogo.png',
    'Feiticeira do Gelo': 'img/sprites/Novos 8bits/leaders/feiticeira-gelo.png',
    'Feiticeira da Luz': 'img/sprites/Novos 8bits/leaders/feiticeira-luz.png',
    'Feiticeira do Metal': 'img/sprites/Novos 8bits/leaders/feiticeira-metal.png',
    'Feiticeira das Plantas': 'img/sprites/Novos 8bits/leaders/feiticeira-plant.png',
    'Feiticeira da Areia': 'img/sprites/Novos 8bits/leaders/feiticeira-sand.png',
    'Feiticeira do Sangue': 'img/sprites/Novos 8bits/leaders/feiticeira-sangue.png',
    'Feiticeira da Tempestade': 'img/sprites/Novos 8bits/leaders/feiticeira-tempestade.png',
    'Feiticeira Umbral': 'img/sprites/Novos 8bits/leaders/feiticeira-umbral.png',
    'Fenghuang': 'img/sprites/Novos 8bits/boss/fenghuang-tevi.png',
    'Dragão de Fogo': 'img/sprites/Novos 8bits/boss/fire-dragon.png',
    'Sapo de Fogo': 'img/sprites/Novos 8bits/units/fire-frog.png',
    'Lagarto de Fogo': 'img/sprites/Novos 8bits/boss/fire-lizard.png',
    'Elfo da Floresta': 'img/sprites/Novos 8bits/leaders/forest-elf.png',
    'Sapo Fantasma': 'img/sprites/Novos 8bits/units/ghost-frog.png',
    'Grifo-Coruja': 'img/sprites/Novos 8bits/boss/grifo-coruja.png',
    'Grootslang': 'img/sprites/Novos 8bits/boss/grootslang.png',
    'Mula sem Cabeça': 'img/sprites/Novos 8bits/units/headless-mula.png',
    'Hipocampo': 'img/sprites/Novos 8bits/units/hipocampo.png',
    'Cavalo': 'img/sprites/Novos 8bits/units/horse.png',
    'Dragão do Gelo': 'img/sprites/Novos 8bits/boss/ice-dragon.png',
    'Golem de Gelo': 'img/sprites/Novos 8bits/boss/ice-golem.png',
    'Jackalope': 'img/sprites/Novos 8bits/units/jackalope.png',
    'Leviatã Alfa': 'img/sprites/Novos 8bits/boss/leviata-formab.png',
    'Dragão da Luz': 'img/sprites/Novos 8bits/boss/light-dragon.png',
    'Lagarto de Gola': 'img/sprites/Novos 8bits/units/lizard-gola.png',
    'Mamute Colossal': 'img/sprites/Novos 8bits/units/mamute.png',
    'Minotauro': 'img/sprites/Novos 8bits/boss/minotauro.png',
    'Coruja Lunar': 'img/sprites/Novos 8bits/units/moon-owl.png',
    'Pesadelo': 'img/sprites/Novos 8bits/units/nightmare.png',
    'Pégaso': 'img/sprites/Novos 8bits/units/pegaso.png',
    'Saci-Pererê': 'img/sprites/Novos 8bits/units/perere.png',
    'Doutor da Praga Ígneo': 'img/sprites/Novos 8bits/leaders/plague-doctor-fire.png',
    'Plessiossauro': 'img/sprites/Novos 8bits/boss/plessio.png',
    'Qilin': 'img/sprites/Novos 8bits/units/qilin.png',
    'Canguru Rochoso': 'img/sprites/Novos 8bits/boss/rock-canguru.png',
    'Golem de Pedra': 'img/sprites/Novos 8bits/boss/rock-golem.png',
    'Sátiro': 'img/sprites/Novos 8bits/units/satiro.png',
    'Cobra': 'img/sprites/Novos 8bits/units/snake.png',
    'Tamanduá': 'img/sprites/Novos 8bits/units/tamandua.png',
    'Templário': 'img/sprites/Novos 8bits/leaders/templar-3.png',
    'Pássaro Trovão': 'img/sprites/Novos 8bits/units/thunderbird.png',
    'Tritão': 'img/sprites/Novos 8bits/units/tritao.png',
    'Unicórnio': 'img/sprites/Novos 8bits/units/unicorn.png',
    'Urso-Coruja': 'img/sprites/Novos 8bits/boss/urso-coruja.png',
    'Urso de Guerra': 'img/sprites/Novos 8bits/boss/urso-polar-guerra.png',
    'Rei Tartaruga Alado': 'img/sprites/Novos 8bits/units/winged-turtleking.png',
    'Golem Rochoso Zumbi': 'img/sprites/Novos 8bits/boss/zombie-rock-golem.png',
    'Mega Besta Solar': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (4).png',
    'Mega Besta Lunar': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (5).png',
    'Mega Besta Terrestre': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (9).png',
    'Mega Besta Cósmica': 'img/sprites/Novos 8bits/units/pokemon-upgrade-mega (42).png',
    'Entidade Ancestral I': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0017.png',
    'Entidade Ancestral II': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0019.png',
    'Entidade Ancestral III': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0020.png',
    'Entidade Ancestral IV': 'img/sprites/Novos 8bits/boss/IMG-20261118-WA0021.png',
}

print(f"Additional evos: {len(ADDITIONAL_EVOS)}")
print(f"Single sprites: {len(SINGLE_SPRITES)}")
