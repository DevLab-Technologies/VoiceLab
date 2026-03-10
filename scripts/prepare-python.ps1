$ErrorActionPreference = "Stop"

$PYTHON_VERSION = "3.10.17"
$PYTHON_BUILD_TAG = "20250317"
$DEST_DIR = "python\python-runtime"
$PLATFORM = "x86_64-pc-windows-msvc"

$TARBALL = "cpython-${PYTHON_VERSION}+${PYTHON_BUILD_TAG}-${PLATFORM}-install_only.tar.gz"
$URL = "https://github.com/indygreg/python-build-standalone/releases/download/${PYTHON_BUILD_TAG}/${TARBALL}"

Write-Host "=== VoiceLab Python Runtime Preparation ==="
Write-Host "Platform: ${PLATFORM}"
Write-Host "Python:   ${PYTHON_VERSION}"

# Clean previous
if (Test-Path $DEST_DIR) { Remove-Item -Recurse -Force $DEST_DIR }
New-Item -ItemType Directory -Path $DEST_DIR -Force | Out-Null

# Download and extract
Write-Host ""
Write-Host "[1/4] Downloading portable Python..."
Invoke-WebRequest -Uri $URL -OutFile "python-standalone.tar.gz"
tar xzf "python-standalone.tar.gz" -C $DEST_DIR --strip-components=1
Remove-Item "python-standalone.tar.gz"

$PYTHON_BIN = "$DEST_DIR\python.exe"
Write-Host "Python binary: $PYTHON_BIN"
& $PYTHON_BIN --version

# Upgrade pip
Write-Host ""
Write-Host "[2/4] Upgrading pip..."
& $PYTHON_BIN -m pip install --upgrade pip --quiet

# Install dependencies (CPU-only PyTorch for Windows)
Write-Host ""
Write-Host "[3/4] Installing Python dependencies..."
Write-Host "Using CPU-only PyTorch for Windows..."
& $PYTHON_BIN -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --quiet
& $PYTHON_BIN -m pip install -r python\requirements.txt --quiet

# Cleanup
Write-Host ""
Write-Host "[4/4] Cleaning up..."
Get-ChildItem -Path $DEST_DIR -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path $DEST_DIR -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host ""
Write-Host "=== Done ==="
$size = (Get-ChildItem -Path $DEST_DIR -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Total size: $([math]::Round($size, 1)) MB"
