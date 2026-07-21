import os
from pathlib import Path

p = Path(r"C:\Users\miche\AppData\Local\Track Concursos")
if p.exists():
    for root, dirs, files in os.walk(p):
        for file in files:
            fp = Path(root) / file
            print(f"{fp} | Size: {fp.stat().st_size} bytes | Modified: {fp.stat().st_mtime}")
else:
    print("Folder does not exist!")
