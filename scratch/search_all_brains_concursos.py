import os
from pathlib import Path

brain_root = Path(r"C:\Users\miche\.gemini\antigravity\brain")
print(f"Scanning all agent brain folders for 'concursos'...")

found_any = False
for root, dirs, files in os.walk(brain_root):
    for file in files:
        if not (file.endswith('.json') or file.endswith('.txt') or file.endswith('.md')):
            continue
        fp = Path(root) / file
        try:
            size = fp.stat().st_size
            # We want files that might contain the backup payload, so let's check size
            if size > 10000: # larger than 10KB
                with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if '\"concursos\"' in content or 'concursos' in content:
                        # Print file path and some stats
                        print(fp)
                        print(f"FOUND MATCH IN BRAIN: {fp} | Size: {size} bytes")
                        found_any = True
        except Exception:
            pass

if not found_any:
    print("No matching profiles found in any brain folder.")
