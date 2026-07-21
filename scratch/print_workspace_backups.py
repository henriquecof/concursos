import os
from pathlib import Path

p = Path(r"c:\Users\miche\Desktop\Track Concursos")
for root, dirs, files in os.walk(p):
    if "backup" in root.lower() or "profile" in root.lower():
        for file in files:
            fp = Path(root) / file
            print(f"{fp} | Size: {fp.stat().st_size} bytes | Modified: {fp.stat().st_mtime}")
