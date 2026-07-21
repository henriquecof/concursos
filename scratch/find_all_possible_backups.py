import os
from pathlib import Path

p = Path(r"C:\Users\miche")
print("Scanning C:\\Users\\miche recursively for any large database/backup files...")

keywords = ["track", "concurso", "backup", "profile", "principal", "snapshot"]

for root, dirs, files in os.walk(p):
    root_lower = root.lower()
    # Skip noisy standard system/program directories to keep it fast
    skip = False
    for noisy in [".git", "node_modules", "venv", ".build-venv", "appdata\\local\\microsoft", 
                  "appdata\\local\\brave", "appdata\\local\\google", "appdata\\local\\uv",
                  "appdata\\local\\programs", "documents\\obsidian vault", "appdata\\roaming\\microsoft"]:
        if noisy in root_lower:
            skip = True
            break
    if skip:
        continue

    # We want files that are JSON, DB, or similar and larger than 2KB
    for file in files:
        file_lower = file.lower()
        if not (file_lower.endswith(".json") or file_lower.endswith(".db") or "backup" in file_lower):
            continue
            
        fp = Path(root) / file
        try:
            size = fp.stat().st_size
            if size > 2000: # larger than 2KB
                # Check if it relates to Track Concursos
                has_kw = any(kw in root_lower or kw in file_lower for kw in keywords)
                if has_kw:
                    import datetime
                    mtime = fp.stat().st_mtime
                    mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"MATCH: {fp} | Size: {size} bytes | Modified: {mtime_str}")
        except Exception:
            pass
