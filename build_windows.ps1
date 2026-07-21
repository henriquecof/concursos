param(
    [string]$PythonVersion = "3.12",
    [switch]$Clean,
    [ValidateSet("CxFreeze", "PyInstaller")]
    [string]$Packager = "CxFreeze"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildVenv = Join-Path $ProjectRoot ".build-venv"
$PythonLauncher = "py"

if ($Clean) {
    foreach ($folder in @("build", "dist", ".build-venv")) {
        $path = Join-Path $ProjectRoot $folder
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }
}

if (-not (Test-Path (Join-Path $BuildVenv "Scripts\\python.exe"))) {
    & $PythonLauncher -$PythonVersion -m venv $BuildVenv
}

$PythonExe = Join-Path $BuildVenv "Scripts\\python.exe"

& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install -r (Join-Path $ProjectRoot "requirements-build.txt")

Push-Location $ProjectRoot
try {
    if ($Packager -eq "PyInstaller") {
        & $PythonExe -m PyInstaller --noconfirm --clean (Join-Path $ProjectRoot "TrackConcursos.spec")
    }
    else {
        & $PythonExe (Join-Path $ProjectRoot "build-resources\\cxfreeze_track_setup.py") build_exe --build-exe (Join-Path $ProjectRoot "dist\\TrackConcursos")
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao gerar build com $Packager."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Build finalizado com $Packager."
Write-Host "Executavel: $(Join-Path $ProjectRoot 'dist\\TrackConcursos\\TrackConcursos.exe')"
