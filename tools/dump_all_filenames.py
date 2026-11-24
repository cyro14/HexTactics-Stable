import os, re, glob, json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = os.path.join(ROOT, 'img', 'sprites', 'Novos 8bits')

# Read all files in each category
units_files = os.listdir(os.path.join(NOVOS, 'units'))
boss_files = os.listdir(os.path.join(NOVOS, 'boss'))
leaders_files = os.listdir(os.path.join(NOVOS, 'leaders'))
baby_files = os.listdir(os.path.join(NOVOS, 'baby'))

print(f"Units: {len(units_files)}, Boss: {len(boss_files)}, Leaders: {len(leaders_files)}, Baby: {len(baby_files)}")

# Build a mapping of files to units/bosses/leaders
print("\n--- UNITS FILES ---")
for f in sorted(units_files):
    print(" ", f)

print("\n--- BOSS FILES ---")
for f in sorted(boss_files):
    print(" ", f)

print("\n--- LEADERS FILES ---")
for f in sorted(leaders_files):
    print(" ", f)

print("\n--- BABY FILES ---")
for f in sorted(baby_files):
    print(" ", f)
