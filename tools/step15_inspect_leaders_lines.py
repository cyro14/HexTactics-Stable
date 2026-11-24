import os, sys, json, re

with open('js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect LEADERS in data.js lines 390-430
lines = text.splitlines()
for i in range(390, 428):
    print(f"{i+1}: {lines[i]}")
