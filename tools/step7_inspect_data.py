import os, sys, json, re

with open('tools/registries.json', 'r', encoding='utf-8') as f:
    regs = json.load(f)

# Read current data.js
with open('js/data.js', 'r', encoding='utf-8') as f:
    data_js = f.read()

# Let's inspect EVOS in data.js
evos_idx = data_js.find('const EVOS = {')
evos_end = data_js.find('};', evos_idx) + 2
print("EVOS block found:", evos_idx, evos_end)

# Let's inspect BEASTS in data.js
beasts_idx = data_js.find('const BEASTS = {')
print("BEASTS block found:", beasts_idx)
