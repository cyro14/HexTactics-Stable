import os, sys, json, re

with open('js/data.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(475, 540):
    print(f"{i+1}: {lines[i]}", end='')
