import os
from pathlib import Path
import datetime

drives = ['D:\\', 'G:\\']
print("Scanning alternative drives D: and G: for Track Concursos databases...")

skip_folders = {
    '$recycle.bin', 'system volume information', '.git', 'venv', '.build-venv', 'node_modules'
}

for drive in drives:
    if not os.path.exists(drive):
        continue
    print(f"Scanning drive {drive}...")
    for root, dirs, files in os.walk(drive):
        root_lower = root.lower()
        if any(s in root_lower for s in skip_folders):
            dirs[:] = []
            continue
        for file in files:
            file_lower = file.lower()
            if not file_lower.endswith('.json'):
                continue
                
            fp = Path(root) / file
            try:
                # If name contains track or concurso, or it matches our database signature
                is_candidate = any(kw in file_lower for kw in ['track', 'concurso', 'backup', 'snapshot'])
                size = fp.stat().st_size
                if size > 5000: # larger than 5KB
                    should_check = is_candidate
                    if not should_check:
                        # Quick check if it matches the profile database signature
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                            head = f.read(1000)
                            if 'concursos' in head and 'materias' in head:
                                should_check = True
                                
                    if should_check:
                        mtime = fp.stat().st_mtime
                        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                        print(f"FOUND MATCH ON {drive}: {fp} | Size: {size} bytes | Modified: {mtime_str}")
            except Exception:
                pass
print("Scan of D: and G: completed.")
