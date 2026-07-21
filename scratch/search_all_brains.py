import os
from pathlib import Path

brain_root = Path(r"C:\Users\miche\.gemini\antigravity\brain")
print(f"Scanning all agent brain folders for 'ct_flashcards'...")

found_any = False
for root, dirs, files in os.walk(brain_root):
    for file in files:
        if not (file.endswith('.json') or file.endswith('.txt') or file.endswith('.md')):
            continue
        fp = Path(root) / file
        try:
            size = fp.stat().st_size
            if size > 1000:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'ct_flashcards' in content:
                        print(f"FOUND MATCH IN BRAIN: {fp} | Size: {size} bytes")
                        found_any = True
        except Exception:
            pass

if not found_any:
    print("No matching profiles found in any brain folder.")
