import os, re, glob

with open('js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

for cat in ['LAND', 'WATER', 'SNOW', 'BOSSES', 'ELITES']:
    m = re.search(r'\b' + cat + r':\s*\[(.*?)\](?=,\s*(?:WATER|SNOW|BOSSES|ELITES|\n\s*\}))', text, re.S)
    if not m:
        m = re.search(r'\b' + cat + r':\s*\[(.*?)\]', text, re.S)
    if m:
        content = m.group(1)
        objs = re.findall(r'\{([^{}]+)\}', content)
        print(f'=== BEASTS.{cat} ({len(objs)}) ===')
        for obj in objs:
            name_m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", obj)
            name = name_m.group(1) if name_m else 'UNKNOWN'
            sprite_m = re.search(r"sprite:\s*['\"]([^'\"]+)['\"]", obj)
            sprite = sprite_m.group(1) if sprite_m else None
            if not sprite:
                print(f'  [NO SPRITE] {name}')
            else:
                exists = os.path.exists(sprite)
                status = 'OK' if exists else 'FILE_NOT_FOUND'
                print(f'  [{status:14}] {name:25} -> {sprite}')
