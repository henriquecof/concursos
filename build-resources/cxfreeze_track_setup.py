import os
import sys
from pathlib import Path

from cx_Freeze import Executable, setup


PROJECT_ROOT = Path(__file__).resolve().parents[1]
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PROJECT_ROOT))


build_exe_options = {
    "packages": ["webview", "track_concursos_app"],
    "include_files": [
        ("www", "www"),
    ],
    "excludes": [
        "PyInstaller",
        "cx_Freeze",
        "freeze_core",
        "pip",
        "setuptools",
        "wheel",
        "tkinter",
        "unittest",
        "email",
        "pydoc",
    ],
}


setup(
    name="Track Concursos",
    version="1.0.6",
    description="Track Concursos",
    options={"build_exe": build_exe_options},
    executables=[
        Executable(
            "Track Concursos.pyw",
            target_name="TrackConcursos.exe",
            base="Win32GUI",
            icon="build-resources/track_concursos_oficial.ico",
        )
    ],
)
