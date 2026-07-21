import os
from pathlib import Path

p = Path(r"C:\Users\miche\AppData\Local\Track Concursos")
print(f"Path: {p}")
print(f"Exists: {p.exists()}")
if p.exists():
    for root, dirs, files in os.walk(p):
        print(f"Directory: {root}")
        for file in files:
            fp = Path(root) / file
            print(f"  - {file} ({fp.stat().st_size} bytes, modified: {fp.stat().st_mtime})")
