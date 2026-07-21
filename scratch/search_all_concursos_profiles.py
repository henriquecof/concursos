import os
from pathlib import Path
import datetime

home = Path(os.path.expanduser('~'))
print("Searching for any JSON files containing 'concursos' and 'materias'...")
skip_folders = {
    'brave-browser', 'chrome', 'edge', 'antigravity-browser-profile', '.git', 'venv', 
    '.build-venv', 'node_modules', 'microsoft', 'package cache', 'cache', 'packages'
}
for root, dirs, files in os.walk(home):
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
            if size > 5000: # larger than 5KB
                with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                    content_head = f.read(1000)
                    if 'concursos' in content_head and 'materias' in content_head:
                        mtime = fp.stat().st_mtime
                        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                        print(f"MATCHING PROFILE FILE: {fp} | Size: {size} bytes | Modified: {mtime_str}")
        except Exception:
            pass
