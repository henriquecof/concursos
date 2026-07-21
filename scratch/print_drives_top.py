import os
import sys

# Reconfigure stdout to use utf-8 to prevent any encoding errors in console output
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

for drive in ['D:\\', 'G:\\']:
    if os.path.exists(drive):
        try:
            print(f"--- Top level of {drive} ---")
            for item in os.listdir(drive):
                print(f"  {item}")
        except Exception as e:
            print(f"Error listing {drive}: {e}")
