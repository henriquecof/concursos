import os
from pathlib import Path
import datetime

target_paths = [
    r"D:\Concursos",
    r"D:\Concursos Ultimate",
    r"D:\Telegram Concursos",
    r"D:\hd antigo",
    r"G:\Meu Drive",
]

print("Starting targeted search in specific folders on D: and G:...")
skip_folders = {
    '.git', 'venv', '.build-venv', 'node_modules', 'cache'
}

for base_dir in target_paths:
    if not os.path.exists(base_dir):
        print(f"Folder not found: {base_dir}")
        continue
    print(f"Searching in: {base_dir}...")
    for root, dirs, files in os.walk(base_dir):
        root_lower = root.lower()
        if any(s in root_lower for s in skip_folders):
            dirs[:] = []
            continue
        for file in files:
            file_lower = file.lower()
            if not (file_lower.endswith('.json') or 'backup' in file_lower or 'profile' in file_lower):
                continue
                
            fp = Path(root) / file
            try:
                size = fp.stat().st_size
                if size > 5000: # larger than 5KB
                    is_candidate = any(kw in file_lower for kw in ['track', 'concurso', 'backup', 'snapshot'])
                    if not is_candidate:
                        # Quick check for database signature
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                            head = f.read(1000)
                            if 'concursos' in head and 'materias' in head:
                                is_candidate = True
                    if is_candidate:
                        mtime = fp.stat().st_mtime
                        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                        print(f"MATCH: {fp} | Size: {size} bytes | Modified: {mtime_str}")
            except Exception:
                pass
print("Targeted search completed.")
