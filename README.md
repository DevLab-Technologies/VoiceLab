<h1 align="center">VoiceLab</h1>

<p align="center">
  <strong>Open-source desktop app for zero-shot voice cloning and text-to-speech</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#supported-models">Models</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#building">Building</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platforms" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/electron-latest-9feaf9" alt="Electron" />
  <img src="https://img.shields.io/badge/python-3.10+-3776ab" alt="Python" />
</p>

---

## What is VoiceLab?

VoiceLab is a cross-platform desktop application that lets you clone any voice from a short audio sample and generate speech in **13 languages** across **12 Arabic dialects**. Record or upload a few seconds of reference audio, type your text, and get natural-sounding speech in the cloned voice — all running locally on your machine.

## Features

- **Zero-shot voice cloning** — Clone any voice from a 3-10 second audio sample
- **Multi-model architecture** — Choose between HabibiTTS (Arabic) and Qwen3-TTS (multilingual)
- **13 languages** — Arabic, English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian, and more
- **12 Arabic dialects** — Egyptian, Gulf, Levantine, Maghrebi, MSA, and 7 more regional dialects
- **Voice profiles** — Save and manage multiple voice profiles for quick reuse
- **Generation history** — Browse, replay, and manage all past generations
- **Fully offline** — Everything runs locally, no cloud APIs or internet required after model download
- **Cross-platform** — macOS (Apple Silicon & Intel), Windows, and Linux

## Supported Models

| Model | Languages | Size | Use Case |
|-------|-----------|------|----------|
| **HabibiTTS** | Arabic (12 dialects) | ~800 MB | Arabic dialect-specific TTS with high fidelity |
| **Qwen3-TTS 1.7B** | EN, ZH, JA, KO, DE, FR, RU, PT, ES, IT | ~3.4 GB | Multilingual TTS with voice cloning |

Models are downloaded on-demand from the Settings page. Only one model is loaded in memory at a time to keep resource usage low.

## Installation

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+
- **SoX** (for audio processing)
  - macOS: `brew install sox`
  - Ubuntu/Debian: `sudo apt install sox`
  - Windows: [Download from SourceForge](http://sox.sourceforge.net/)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DevLab-Technologies/VoiceLab.git
cd VoiceLab

# Install Node dependencies
npm install

# Create Python virtual environment and install dependencies
python3 -m venv python/.venv
source python/.venv/bin/activate    # On Windows: python\.venv\Scripts\activate
pip install -r python/requirements.txt

# Start in development mode
npm run dev
```

On first launch, go to **Settings** to download one or both TTS models.

## Development

### Project Structure

```
VoiceLab/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App entry, window management
│   │   └── python.ts      # Python backend lifecycle
│   ├── preload/           # Electron preload scripts
│   └── renderer/          # React frontend
│       └── src/
│           ├── api/       # Backend API client
│           ├── components/# Reusable UI components
│           ├── pages/     # App pages (TTS, Profiles, Settings, History)
│           ├── store/     # Zustand state management
│           ├── types/     # TypeScript types
│           └── lib/       # Constants and utilities
├── python/
│   ├── server.py          # FastAPI server entry point
│   └── app/
│       ├── main.py        # FastAPI app setup
│       ├── config.py      # Configuration and paths
│       ├── models.py      # Pydantic schemas
│       ├── routers/       # API endpoints (tts, profiles, models, health)
│       └── services/      # TTS engines, model manager, profile store
├── scripts/               # Build helper scripts
├── resources/             # App icons and entitlements
└── .github/workflows/     # CI/CD pipeline
```

### Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand for state
- **Backend**: Python FastAPI server spawned as a child process by Electron
- **TTS Engines**: Abstract `BaseTTSEngine` with `HabibiEngine` and `QwenEngine` implementations
- **Model Manager**: Singleton that manages downloads, engine lifecycle, and ensures only one model is loaded at a time

### Development Commands

```bash
npm run dev          # Start in development mode (hot-reload)
npm run build        # Build the frontend
npm run start        # Preview the built app
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Backend health check and model status |
| `GET` | `/api/models` | List all available models with download status |
| `POST` | `/api/models/{id}/download` | Start downloading a model |
| `DELETE` | `/api/models/{id}` | Remove a model |
| `GET` | `/api/profiles` | List voice profiles |
| `POST` | `/api/profiles` | Create a new voice profile |
| `POST` | `/api/tts/generate` | Generate speech from text |
| `GET` | `/api/audio/{id}` | Stream generated audio |

## Building

### Build for Your Platform

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

### Production Build with Bundled Python

For distributable builds that include a portable Python runtime:

```bash
# macOS/Linux
./scripts/prepare-python.sh

# Windows (PowerShell)
.\scripts\prepare-python.ps1

# Then build
npm run build:mac   # or build:win / build:linux
```

### CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/build.yml`) that builds for all platforms on every push. It:

1. Downloads a portable Python runtime (python-build-standalone)
2. Installs Python dependencies
3. Builds the Electron app
4. Packages platform-specific installers (DMG, NSIS, AppImage)
5. Creates draft GitHub releases with artifacts

## Data Storage

VoiceLab stores all data locally in `~/.voicelab/`:

```
~/.voicelab/
├── profiles/        # Voice profiles with reference audio
├── generations/     # Generated audio files
└── models.json      # Model download state
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) &copy; DevLab Technologies
