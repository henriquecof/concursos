import os
from pathlib import Path
import ctypes

p = Path(r"C:\Users\miche\AppData\Local\Track Concursos")
print(f"Scanning {p} recursively including hidden/system files...")

if p.exists():
    for root, dirs, files in os.walk(p):
        for name in dirs + files:
            fp = Path(root) / name
            try:
                attrs = ctypes.windll.kernel32.GetFileAttributesW(str(fp))
                is_hidden = bool(attrs & 2)
                is_system = bool(attrs & 4)
                size_str = f"{fp.stat().st_size} bytes" if fp.is_file() else "DIR"
                print(f"{fp} | {size_str} | Hidden: {is_hidden} | System: {is_system}")
            except Exception as e:
                print(f"Error reading attributes for {fp}: {e}")
else:
    print("Folder does not exist.")
