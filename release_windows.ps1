param(
    [string]$PythonVersion = "3.12",
    [switch]$Clean,
    [switch]$Sign,
    [string]$CertThumbprint,
    [string]$PfxPath,
    [string]$PfxPassword,
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [string]$SignToolPath,
    [switch]$SkipSmokeTest,
    [ValidateSet("CxFreeze", "PyInstaller")]
    [string]$Packager = "CxFreeze"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildScript = Join-Path $ProjectRoot "build_windows.ps1"
$InstallerScript = Join-Path $ProjectRoot "installer\\TrackConcursos.iss"
$InstallerCompilerCandidates = @(
    "C:\Users\miche\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)

function Resolve-SignToolPath {
    param([string]$PreferredPath)

    if ($PreferredPath) {
        if (-not (Test-Path $PreferredPath)) {
            throw "SignTool não encontrado em: $PreferredPath"
        }
        return $PreferredPath
    }

    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = Get-ChildItem "C:\Program Files (x86)\Windows Kits" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
        Sort-Object FullName -Descending

    if ($candidates) {
        return $candidates[0].FullName
    }

    throw "SignTool não foi encontrado. Instale o Windows SDK ou informe -SignToolPath."
}

function Resolve-InnoCompilerPath {
    foreach ($candidate in $InstallerCompilerCandidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $found = Get-ChildItem "$env:LOCALAPPDATA\\Programs" -Recurse -Filter ISCC.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1

    if ($found) {
        return $found.FullName
    }

    throw "ISCC.exe não foi encontrado. Instale o Inno Setup."
}

function Get-SignArguments {
    param(
        [string]$FilePath,
        [string]$ResolvedSignToolPath
    )

    $args = @(
        "sign",
        "/fd", "sha256",
        "/td", "sha256",
        "/tr", $TimestampUrl
    )

    if ($PfxPath) {
        if (-not (Test-Path $PfxPath)) {
            throw "Arquivo PFX não encontrado em: $PfxPath"
        }

        $args += @("/f", $PfxPath)
        if ($PfxPassword) {
            $args += @("/p", $PfxPassword)
        }
    }
    elseif ($CertThumbprint) {
        $args += @("/sha1", $CertThumbprint)
    }
    else {
        throw "Para assinar, informe -CertThumbprint ou -PfxPath."
    }

    $args += $FilePath
    return ,$args
}

function Sign-Artifact {
    param(
        [string]$FilePath,
        [string]$ResolvedSignToolPath
    )

    if (-not (Test-Path $FilePath)) {
        throw "Arquivo para assinatura não encontrado: $FilePath"
    }

    $args = Get-SignArguments -FilePath $FilePath -ResolvedSignToolPath $ResolvedSignToolPath
    & $ResolvedSignToolPath @args
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao assinar: $FilePath"
    }
}

function Test-ReleaseExecutable {
    param([string]$FilePath)

    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        throw "Executavel de release nao encontrado: $FilePath"
    }

    $beforeIds = @{}
    Get-Process -Name "TrackConcursos" -ErrorAction SilentlyContinue | ForEach-Object {
        $beforeIds[[int]$_.Id] = $true
    }

    Write-Host "Testando abertura do executavel de release..."
    $process = $null
    try {
        $process = Start-Process -FilePath $FilePath -WorkingDirectory (Split-Path -Parent $FilePath) -PassThru -ErrorAction Stop
        Start-Sleep -Seconds 5

        if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
            throw "O executavel desapareceu apos a tentativa de abertura. Release abortada."
        }

        $launched = Get-Process -Name "TrackConcursos" -ErrorAction SilentlyContinue |
            Where-Object { -not $beforeIds.ContainsKey([int]$_.Id) }

        if (-not $launched) {
            throw "O executavel nao permaneceu em execucao no teste de release."
        }

        Write-Host "Smoke test do executavel aprovado."
    }
    catch {
        if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
            throw "Falha critica: o Windows removeu ou bloqueou o executavel durante o teste. Release abortada. Detalhe: $($_.Exception.Message)"
        }
        throw
    }
    finally {
        Get-Process -Name "TrackConcursos" -ErrorAction SilentlyContinue |
            Where-Object { -not $beforeIds.ContainsKey([int]$_.Id) } |
            Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

& $BuildScript -PythonVersion $PythonVersion -Clean:$Clean -Packager $Packager

$ExePath = Join-Path $ProjectRoot "dist\\TrackConcursos\\TrackConcursos.exe"
if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    throw "Executavel compilado nao encontrado: $ExePath"
}

if ($Sign) {
    $ResolvedSignTool = Resolve-SignToolPath -PreferredPath $SignToolPath
    Sign-Artifact -FilePath $ExePath -ResolvedSignToolPath $ResolvedSignTool
}

if (-not $SkipSmokeTest) {
    Test-ReleaseExecutable -FilePath $ExePath
}

$InnoCompiler = Resolve-InnoCompilerPath
& $InnoCompiler $InstallerScript
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao compilar o instalador."
}

$SetupPath = Get-ChildItem (Join-Path $ProjectRoot "installer\\output") -Filter "TrackConcursos-Setup*.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $SetupPath) {
    throw "Instalador compilado nao encontrado em installer\\output."
}

if ($Sign) {
    Sign-Artifact -FilePath $SetupPath -ResolvedSignToolPath $ResolvedSignTool
}

Write-Host ""
Write-Host "Release finalizada."
Write-Host "Executável: $ExePath"
Write-Host "Instalador: $SetupPath"
if ($Sign) {
    Write-Host "Assinatura aplicada."
}
