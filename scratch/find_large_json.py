import os
from pathlib import Path

search_paths = [
    Path(r"c:\Users\miche\Desktop\Track Concursos"),
    Path(r"C:\Users\miche\Desktop\Track Concursos Beta"),
    Path(os.environ.get("LOCALAPPDATA", "")),
]

print("Searching for all JSON files...")
for base in search_paths:
    if not base or not base.exists():
        continue
    for root, dirs, files in os.walk(base):
        if ".git" in root or ".build-venv" in root or "venv" in root or "node_modules" in root or "EBWebView" in root:
            continue
        for file in files:
            if file.endswith(".json"):
                p = Path(root) / file
                try:
                    size = p.stat().st_size
                    # Only show files with size > 1000 bytes, which indicates real data rather than empty skeletons
                    if size > 500:
                        import datetime
                        mtime = p.stat().st_mtime
                        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                        print(f"FOUND: {p} | Size: {size} bytes | Modified: {mtime_str}")
                except Exception as e:
                    pass
