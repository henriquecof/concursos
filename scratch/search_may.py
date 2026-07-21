import os
from pathlib import Path
import datetime

search_folders = [
    os.path.expanduser('~/Downloads'),
    os.path.expanduser('~/Documents'),
    os.path.expanduser('~/Desktop'),
    os.path.expandvars('%LOCALAPPDATA%'),
    os.path.expandvars('%APPDATA%'),
]

print("Searching for files with '2026-05-' in key directories...")
for base in search_folders:
    if not os.path.exists(base):
        continue
    for root, dirs, files in os.walk(base):
        root_lower = root.lower()
        if any(b in root_lower for b in ['brave-browser', 'chrome', 'edge', 'antigravity-browser-profile']):
            dirs[:] = []
            continue
        for file in files:
            if '2026-05-' in file:
                fp = Path(root) / file
                try:
                    size = fp.stat().st_size
                    mtime = fp.stat().st_mtime
                    mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"FOUND MATCH: {fp} | Size: {size} bytes | Modified: {mtime_str}")
                except Exception:
                    pass
