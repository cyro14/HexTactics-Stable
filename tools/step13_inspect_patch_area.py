import os, sys, json, re

# Let's inspect data.js lines 420-530
with open('js/data.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in data.js: {len(lines)}")
for i in range(450, 485):
    print(f"{i+1}: {lines[i]}", end='')
