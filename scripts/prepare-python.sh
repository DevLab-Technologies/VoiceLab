#!/usr/bin/env bash
set -euo pipefail

PYTHON_VERSION="3.10.17"
PYTHON_BUILD_TAG="20250317"
DEST_DIR="python/python-runtime"

# Detect platform
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  PLATFORM="aarch64-apple-darwin" ;;
  Darwin-x86_64) PLATFORM="x86_64-apple-darwin" ;;
  Linux-x86_64)  PLATFORM="x86_64-unknown-linux-gnu" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)"; exit 1 ;;
esac

TARBALL="cpython-${PYTHON_VERSION}+${PYTHON_BUILD_TAG}-${PLATFORM}-install_only.tar.gz"
URL="https://github.com/indygreg/python-build-standalone/releases/download/${PYTHON_BUILD_TAG}/${TARBALL}"

echo "=== VoiceLab Python Runtime Preparation ==="
echo "Platform: ${PLATFORM}"
echo "Python:   ${PYTHON_VERSION}"

# Clean previous
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

# Download and extract
echo ""
echo "[1/4] Downloading portable Python..."
curl -L --progress-bar "$URL" | tar xz -C "$DEST_DIR" --strip-components=1

PYTHON_BIN="$DEST_DIR/bin/python3"
echo "Python binary: $PYTHON_BIN"
"$PYTHON_BIN" --version

# Upgrade pip
echo ""
echo "[2/4] Upgrading pip..."
"$PYTHON_BIN" -m pip install --upgrade pip --quiet

# Install dependencies
echo ""
echo "[3/4] Installing Python dependencies..."

# For Linux, use CPU-only PyTorch to reduce size
if [[ "$(uname -s)" == "Linux" ]]; then
  echo "Using CPU-only PyTorch for Linux..."
  "$PYTHON_BIN" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --quiet
fi

"$PYTHON_BIN" -m pip install -r python/requirements.txt --quiet

# Cleanup to reduce size
echo ""
echo "[4/4] Cleaning up..."
find "$DEST_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -name "*.pyc" -delete 2>/dev/null || true
find "$DEST_DIR" -type d -name "test" -path "*/site-packages/*/test" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -type d -name "tests" -path "*/site-packages/*/tests" -exec rm -rf {} + 2>/dev/null || true
find "$DEST_DIR" -name "libnvToolsExt*" -delete 2>/dev/null || true
find "$DEST_DIR" -name "libcudart*" -delete 2>/dev/null || true

echo ""
echo "=== Done ==="
du -sh "$DEST_DIR"
