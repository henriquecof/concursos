import os
from pathlib import Path
import datetime

backup_folders = [
    r"D:\Concursos",
    r"D:\Concursos Ultimate",
    r"D:\Telegram Concursos",
    r"D:\hd antigo",
    r"D:\backup miniquinha",
    r"D:\Back up Miniquinha 2.0",
    r"D:\Backup xiaomi",
]

print("Searching D: drive backup folders for any valid profile databases...")
skip_folders = {
    '.git', 'venv', '.build-venv', 'node_modules', 'cache'
}

found_any = False
for base in backup_folders:
    if not os.path.exists(base):
        continue
    print(f"Searching in: {base}...")
    for root, dirs, files in os.walk(base):
        root_lower = root.lower()
        if any(s in root_lower for s in skip_folders):
            dirs[:] = []
            continue
        for file in files:
            if not file.lower().endswith('.json'):
                continue
            fp = Path(root) / file
            try:
                size = fp.stat().st_size
                if size > 10000: # larger than 10KB
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                        head = f.read(1000)
                        if 'concursos' in head and 'materias' in head:
                            mtime = fp.stat().st_mtime
                            mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                            print(f"MATCH: {fp} | Size: {size} bytes | Modified: {mtime_str}")
                            found_any = True
            except Exception:
                pass

if not found_any:
    print("No valid profile backups found in the specified D: drive backup folders.")
