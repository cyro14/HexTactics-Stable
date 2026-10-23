# ==========================================
# IMPORTAÇÃO DOS SPRITES DE img/sprites/ajustar
# Agrupa por prompt-base (o sufixo ~N sao variacoes da mesma criatura),
# escolhe a melhor variacao individual (ignora as grades de contato
# largas/altas), remove o fundo (flood-fill), realca (nitidez+cor) e
# salva como img/sprites/<nome>.png. Os originais vao para processados/.
# ==========================================
import os
import re
import shutil
from PIL import Image
from collections import defaultdict

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_backgrounds import strip as strip_bg
from enhance_tiles import enhance_sprite

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'img', 'sprites', 'ajustar')
DONE = os.path.join(SRC, 'processados')
OUT = os.path.join(ROOT, 'img', 'sprites')

# base-do-download -> (nome no jogo, arquivo de saida)
GROUPS = {
    '1781107468177': 'abismo_carmesim',
    '1781107675325': 'sentinela_glacial',
    '1781107859350': 'vigia_abissal',
    '1781107954392': 'espectro_violeta',
    '1781108122466': 'guardiao_das_areias',
    '1781108326070': 'colosso_umbral',
    '1781110410986': 'misterio_de_cinzas',
    '1781111910112': 'bruto_das_dunas',
    '1781112044281': 'cacador_ocre',
    '1781112206393': 'gargula_cinzenta',
    '1781112295787': 'cavaleiro_lunar',
    '1781112345727': 'aparicao_argentea',
    '1781112478394': 'ser_tempestuoso',
    'file_00000000f7c4720e804fb06060245d99': 'devorador_sombras',
}


def main():
    os.makedirs(DONE, exist_ok=True)
    files = [f for f in os.listdir(SRC) if f.endswith('.png')]

    # agrupa: 'nome~3.png' -> 'nome'
    groups = defaultdict(list)
    for f in files:
        base = re.sub(r'~\d+\.png$', '.png', f)
        groups[base].append(f)

    for base, variants in sorted(groups.items()):
        key = re.sub(r'\.png$', '', base)
        if key not in GROUPS:
            continue
        nome = GROUPS[key]

        # melhor variacao individual: maior arquivo que NAO seja grade
        cands = []
        for v in variants:
            p = os.path.join(SRC, v)
            with Image.open(p) as im:
                w, h = im.size
            if w > 700 or h > 900:
                continue  # grade de contato — pula
            cands.append((os.path.getsize(p), v))
        if not cands:
            print(f'[PULA] {key}: só grades de contato')
            continue
        best = max(cands)[1]

        src_path = os.path.join(SRC, best)
        dst_path = os.path.join(OUT, nome + '.png')
        shutil.copy(src_path, dst_path)

        status, removed, _ = strip_bg(dst_path)
        if status.startswith('ok'):
            enhance_sprite(dst_path)
            kb = os.path.getsize(dst_path) // 1024
            print(f'[OK] {nome}.png <- {best} ({status}, -{removed}px, {kb}KB)')
        else:
            print(f'[ATENCAO] {nome}: strip retornou {status} — arquivo mantido')

    # move TUDO para processados/ (limpa a pasta de trabalho, nada é apagado)
    for f in files:
        src = os.path.join(SRC, f)
        if os.path.isfile(src):
            shutil.move(src, os.path.join(DONE, f))
    print('Originais movidos para ajustar/processados/')


if __name__ == '__main__':
    main()