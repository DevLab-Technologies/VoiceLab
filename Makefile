.PHONY: help dev install build prepare-python release-mac release-win release-linux release-all clean

# ──────────────────────────────────────────────────────────────
# VoiceLab — Build & Release
# ──────────────────────────────────────────────────────────────

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ───────────────────────────────────────────────

dev: ## Start dev environment (Electron + Python backend)
	npm run dev

install: ## Install all dependencies (npm + Python venv)
	npm ci
	@if [ ! -d python/.venv ]; then \
		echo "Creating Python venv..."; \
		python3 -m venv python/.venv; \
	fi
	python/.venv/bin/pip install --upgrade pip --quiet
	python/.venv/bin/pip install -r python/requirements.txt --quiet
	@echo "Done — all dependencies installed."

# ── Build ─────────────────────────────────────────────────────

build: ## Build Electron app (frontend + main + preload)
	npm run build

prepare-python: ## Download portable Python runtime and install deps
	@echo "Preparing portable Python runtime..."
	bash scripts/prepare-python.sh
	@echo ""
	@echo "Python runtime ready at python/python-runtime/"

# ── Release ───────────────────────────────────────────────────

release-mac: prepare-python build ## Build macOS release (.dmg)
	npx dotenv -- npx electron-builder --mac --publish never
	@echo ""
	@echo "macOS release ready in dist/"
	@ls -lh dist/*.dmg 2>/dev/null || true

release-win: prepare-python build ## Build Windows release (.exe) — run from macOS/Linux for cross-compile
	npx electron-builder --win --publish never
	@echo ""
	@echo "Windows release ready in dist/"
	@ls -lh dist/*.exe 2>/dev/null || true

release-linux: prepare-python build ## Build Linux release (.AppImage)
	npx electron-builder --linux --publish never
	@echo ""
	@echo "Linux release ready in dist/"
	@ls -lh dist/*.AppImage 2>/dev/null || true

release-all: prepare-python build ## Build releases for all platforms
	npx dotenv -- npx electron-builder --mac --win --linux --publish never
	@echo ""
	@echo "All releases ready in dist/"
	@ls -lh dist/*.dmg dist/*.exe dist/*.AppImage 2>/dev/null || true

# ── Cleanup ───────────────────────────────────────────────────

clean: ## Remove all build artifacts
	rm -rf dist/ out/ python/python-runtime/
	@echo "Cleaned dist/, out/, python/python-runtime/"
