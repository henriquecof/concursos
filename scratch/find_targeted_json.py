import os
from pathlib import Path

search_paths = [
    Path(r"c:\Users\miche\Desktop\Track Concursos"),
    Path(r"C:\Users\miche\Desktop\Track Concursos Beta"),
    Path(os.environ.get("LOCALAPPDATA", "")),
    Path(os.environ.get("APPDATA", "")),
]

print("Targeted search for Track Concursos JSON files...")
for base in search_paths:
    if not base or not base.exists():
        continue
    for root, dirs, files in os.walk(base):
        # We ONLY want folders that pertain to Track Concursos or backups
        root_lower = root.lower()
        if "track" not in root_lower and "concurso" not in root_lower:
            continue
        if ".git" in root or ".build-venv" in root or "venv" in root or "node_modules" in root or "EBWebView" in root:
            continue
        for file in files:
            if file.endswith(".json"):
                p = Path(root) / file
                try:
                    size = p.stat().st_size
                    import datetime
                    mtime = p.stat().st_mtime
                    mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"FOUND: {p} | Size: {size} bytes | Modified: {mtime_str}")
                except Exception as e:
                    pass
