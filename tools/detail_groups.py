import os, re, glob
from collections import defaultdict

def scan():
    base = r'img\sprites\Novos 8bits'
    folders = ['units', 'boss', 'leaders', 'baby']
    
    for fld in folders:
        p = os.path.join(base, fld)
        files = os.listdir(p)
        print(f"=== FOLDER: {fld} ({len(files)}) ===")
        # group by stem
        stems = defaultdict(list)
        for f in sorted(files):
            name, ext = os.path.splitext(f)
            # check day / night
            m_dn = re.match(r'^(.*?)[-_](dia|noite|night|day)$', name, re.I)
            if m_dn:
                stem = m_dn.group(1).lower()
                stems[stem].append(('daynight', m_dn.group(2).lower(), f))
                continue
            # check number
            m_num = re.match(r'^(.*?)[-_ ]+(?:\()?(\d+)(?:\))?$', name)
            if m_num:
                stem = m_num.group(1).strip().lower()
                num = int(m_num.group(2))
                stems[stem].append(('num', num, f))
                continue
            # check baby- prefix
            if name.lower().startswith('baby-'):
                stem = name[5:].lower()
                stems[stem].append(('baby', 0, f))
                continue
            stems[name.lower()].append(('base', 1, f))
            
        for stem, variants in sorted(stems.items()):
            print(f"  {stem:25} -> {variants}")

scan()
