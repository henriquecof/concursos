import os
from pathlib import Path

program_folders = [
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    os.path.expandvars("%LOCALAPPDATA%\\Programs"),
]

print("Searching for file recovery utilities...")
recovery_keywords = ['recuva', 'testdisk', 'photorec', 'undelete', 'winfr']

found_any = False
for base in program_folders:
    if not os.path.exists(base):
        continue
    for root, dirs, files in os.walk(base):
        root_lower = root.lower()
        for kw in recovery_keywords:
            if kw in root_lower:
                print(f"FOUND RECOVERY TOOL DIRECTORY: {root}")
                found_any = True
                break
        for file in files:
            file_lower = file.lower()
            if any(kw in file_lower for kw in recovery_keywords):
                print(f"FOUND RECOVERY EXECUTABLE: {os.path.join(root, file)}")
                found_any = True

if not found_any:
    print("No native file recovery utilities found in program paths.")
