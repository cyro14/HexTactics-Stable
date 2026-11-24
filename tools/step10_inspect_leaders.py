import os, sys, json, re

with open('js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect LEADERS
m = re.search(r'const LEADERS = \[(.*?)\];\s*const FACTIONS', text, re.S)
if m:
    content = m.group(1)
    print("Found LEADERS block of length:", len(content))
    lines = [l.strip() for l in content.split('\n') if l.strip().startswith('{')]
    print(f"Leaders count: {len(lines)}")
    for l in lines:
        print(l[:90])
