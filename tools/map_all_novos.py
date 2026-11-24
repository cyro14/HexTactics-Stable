import os, re, glob, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

def analyze():
    # Scan all png files in Novos 8bits
    files = {}
    for root, dirs, fnames in os.walk(NOVOS):
        cat = os.path.basename(root)
        for fn in fnames:
            if fn.lower().endswith('.png'):
                rel = os.path.join('img', 'sprites', 'Novos 8bits', cat, fn).replace('\\', '/')
                files[fn] = (cat, rel)
                
    print(f"Total PNG files in Novos 8bits: {len(files)}")
    
    # Classify by family
    # Rules:
    # 1. Day / Night:
    #    e.g. boto-dia.png / boto-night.png -> 'boto': {'dia': path, 'night': path}
    #    human-king-dia.png / ogre-king-noite.png (or human-king)
    # 2. Numbered Evolutions:
    #    base (no number or 1) -> lvl 1
    #    -2 or (2) -> lvl 2
    #    -3 -> lvl 3
    #    baby-xxx -> baby (lvl 0)
    
    day_night_pairs = {}
    families = defaultdict(dict)
    
    for fn, (cat, rel) in files.items():
        stem, ext = os.path.splitext(fn)
        
        # Check day/night
        m_dn = re.match(r'^(.*?)[-_](dia|noite|night|day)$', stem, re.I)
        if m_dn:
            base_key = m_dn.group(1).lower()
            tag = m_dn.group(2).lower()
            if tag in ('noite', 'night'):
                tag = 'night'
            else:
                tag = 'day'
            if base_key not in day_night_pairs:
                day_night_pairs[base_key] = {}
            day_night_pairs[base_key][tag] = rel
            continue
            
        # Check baby
        if stem.lower().startswith('baby-'):
            base_key = stem[5:].lower()
            families[base_key]['baby'] = rel
            continue
            
        # Check numbered evo
        m_num = re.match(r'^(.*?)[-_ ]+(?:\()?(\d+)(?:\))?$', stem)
        if m_num:
            base_key = m_num.group(1).strip().lower()
            num = int(m_num.group(2))
            families[base_key][num] = rel
            continue
            
        # Base
        base_key = stem.lower()
        families[base_key][1] = rel
        
    print(f"Day/night pairs found: {list(day_night_pairs.keys())}")
    for k, v in day_night_pairs.items():
        print(f"  {k} -> {v}")
        
    print(f"\nEvolution families with >1 stage:")
    for k, v in sorted(families.items()):
        if len(v) > 1:
            print(f"  {k:25} -> {v}")

analyze()
