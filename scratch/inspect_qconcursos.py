import os
from pathlib import Path

p = Path(r"C:\Users\miche\Desktop\Projeto Qconcursos")
if p.exists():
    for root, dirs, files in os.walk(p):
        for file in files:
            if file.endswith(".json"):
                fp = Path(root) / file
                print(f"{fp} | Size: {fp.stat().st_size} bytes | Modified: {fp.stat().st_mtime}")
else:
    print("Folder does not exist!")
