import os
from pathlib import Path

# Data directory for profiles and generations
DATA_DIR = Path(os.environ.get("VOICELAB_DATA_DIR", Path.home() / ".voicelab"))
PROFILES_DIR = DATA_DIR / "profiles"
GENERATIONS_DIR = DATA_DIR / "generations"
TRANSCRIPTIONS_DIR = DATA_DIR / "transcriptions"
DB_FILE = DATA_DIR / "data.json"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
GENERATIONS_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPTIONS_DIR.mkdir(parents=True, exist_ok=True)

# Audio settings
SAMPLE_RATE = 24000
MAX_AUDIO_DURATION_SEC = 30
SUPPORTED_AUDIO_FORMATS = {".wav", ".mp3", ".ogg", ".webm", ".flac", ".m4a"}

# YouTube settings
YOUTUBE_TEMP_DIR = DATA_DIR / "youtube_temp"
MAX_YOUTUBE_DURATION_SEC = 600
