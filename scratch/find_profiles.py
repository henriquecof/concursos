import os
from pathlib import Path

search_paths = [
    Path(r"c:\Users\miche\Desktop\Track Concursos"),
    Path(os.environ.get("LOCALAPPDATA", "")),
    Path(os.environ.get("APPDATA", "")),
    Path(os.path.expanduser("~")),
]

print("Searching for manifest.json and profile.json...")
for base in search_paths:
    if not base or not base.exists():
        continue
    for root, dirs, files in os.walk(base):
        # Prevent searching too deep or virtual environments
        if ".git" in root or ".build-venv" in root or "venv" in root or "node_modules" in root:
            continue
        for file in files:
            if file in ("manifest.json", "profile.json", "Track_Concursos_backup.json"):
                p = Path(root) / file
                try:
                    size = p.stat().st_size
                    mtime = p.stat().st_mtime
                    import datetime
                    mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"FOUND: {p} | Size: {size} bytes | Modified: {mtime_str}")
                except Exception as e:
                    print(f"FOUND (error reading stat): {p} - {e}")
