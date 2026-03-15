import json
import uuid
import shutil
import logging
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

import soundfile as sf
from pydub import AudioSegment

from app.config import DB_FILE, PROFILES_DIR, GENERATIONS_DIR, TRANSCRIPTIONS_DIR, SAMPLE_RATE

logger = logging.getLogger(__name__)


class ProfileStore:
    def __init__(self):
        self._data = {"profiles": [], "generations": [], "transcriptions": []}
        self._lock = threading.Lock()
        self._load()
        # Migrate: ensure transcriptions key exists for older data files
        if "transcriptions" not in self._data:
            self._data["transcriptions"] = []
            self._save()

    def _load(self):
        with self._lock:
            if DB_FILE.exists():
                with open(DB_FILE, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            else:
                self._save_unlocked()

    def _save_unlocked(self):
        """Write data to disk. Caller must hold ``_lock``."""
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def _save(self):
        with self._lock:
            self._save_unlocked()

    def list_all(self) -> List[dict]:
        return sorted(self._data["profiles"], key=lambda p: p["created_at"], reverse=True)

    def get(self, profile_id: str) -> Optional[dict]:
        for p in self._data["profiles"]:
            if p["id"] == profile_id:
                return p
        return None

    async def create(
        self,
        name: str,
        dialect: str | None,
        ref_text: str,
        audio_data: bytes,
        audio_filename: str,
        model: str = "habibi-tts",
        language: str | None = None,
    ) -> dict:
        profile_id = str(uuid.uuid4())
        profile_dir = PROFILES_DIR / profile_id
        profile_dir.mkdir(parents=True, exist_ok=True)

        # Save original audio
        ext = Path(audio_filename).suffix.lower()
        original_path = profile_dir / f"original{ext}"
        with open(original_path, "wb") as f:
            f.write(audio_data)

        # Convert to WAV at target sample rate using ffmpeg directly for reliability
        wav_path = profile_dir / "ref_audio.wav"
        try:
            import subprocess
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(original_path),
                 "-ar", str(SAMPLE_RATE), "-ac", "1", "-f", "wav", str(wav_path)],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {result.stderr}")

            # Validate output isn't silent and meets minimum duration
            import numpy as np
            data, sr = sf.read(str(wav_path))
            rms = float(np.sqrt(np.mean(data ** 2)))
            if rms < 1e-6:
                raise ValueError(f"Converted audio is silent (rms={rms}). The recording may be empty.")
            duration = len(data) / sr
            if duration < 2.0:
                raise ValueError(
                    f"Audio is too short ({duration:.1f}s). "
                    f"Please record at least 3 seconds for good quality."
                )
            logger.info(f"Audio converted: duration={duration:.2f}s, rms={rms:.4f}, sr={sr}")
        except FileNotFoundError:
            logger.warning("ffmpeg not found, falling back to pydub")
            try:
                audio = AudioSegment.from_file(str(original_path))
                audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)
                audio.export(str(wav_path), format="wav")
                duration = len(audio) / 1000.0
            except Exception as e2:
                shutil.rmtree(profile_dir)
                raise ValueError(f"Cannot process audio file: {e2}")
        except Exception as e:
            logger.error(f"Audio conversion failed: {e}")
            shutil.rmtree(profile_dir)
            raise ValueError(f"Audio conversion failed: {e}")

        now = datetime.now(timezone.utc).isoformat()
        profile = {
            "id": profile_id,
            "name": name,
            "dialect": dialect,
            "ref_text": ref_text,
            "ref_audio_path": str(wav_path),
            "ref_audio_duration": round(duration, 2),
            "created_at": now,
            "updated_at": now,
            "model": model,
            "language": language,
        }

        with self._lock:
            self._data["profiles"].append(profile)
            self._save_unlocked()
        return profile

    def update(self, profile_id: str, update) -> Optional[dict]:
        with self._lock:
            for i, p in enumerate(self._data["profiles"]):
                if p["id"] == profile_id:
                    update_dict = update.model_dump(exclude_unset=True)
                    for key, value in update_dict.items():
                        if value is not None:
                            p[key] = value if not hasattr(value, "value") else value.value
                    p["updated_at"] = datetime.now(timezone.utc).isoformat()
                    self._data["profiles"][i] = p
                    self._save_unlocked()
                    return p
        return None

    def delete(self, profile_id: str) -> bool:
        with self._lock:
            for i, p in enumerate(self._data["profiles"]):
                if p["id"] == profile_id:
                    self._data["profiles"].pop(i)
                    # Remove files
                    profile_dir = PROFILES_DIR / profile_id
                    if profile_dir.exists():
                        shutil.rmtree(profile_dir)
                    # Remove related generations
                    self._data["generations"] = [
                        g for g in self._data["generations"] if g["profile_id"] != profile_id
                    ]
                    self._save_unlocked()
                    return True
        return False

    # -- Generations --

    def add_generation(
        self,
        profile_id: str,
        profile_name: str,
        text: str,
        dialect: str | None,
        audio_path: str,
        duration: float,
        model: str = "habibi-tts",
        language: str | None = None,
        elapsed_seconds: float = 0.0,
    ) -> dict:
        gen_id = Path(audio_path).parent.name
        now = datetime.now(timezone.utc).isoformat()

        # dialect can be None for non-Arabic models (e.g. Qwen3-TTS)
        if dialect is None:
            dialect_value = None
        elif isinstance(dialect, str):
            dialect_value = dialect
        else:
            dialect_value = dialect.value

        generation = {
            "id": gen_id,
            "profile_id": profile_id,
            "profile_name": profile_name,
            "text": text,
            "dialect": dialect_value,
            "audio_path": audio_path,
            "duration": duration,
            "elapsed_seconds": round(elapsed_seconds, 1),
            "created_at": now,
            "model": model,
            "language": language,
        }
        with self._lock:
            self._data["generations"].append(generation)
            self._save_unlocked()
        return generation

    def list_generations(self) -> List[dict]:
        return sorted(self._data["generations"], key=lambda g: g["created_at"], reverse=True)

    def get_generation(self, generation_id: str) -> Optional[dict]:
        for g in self._data["generations"]:
            if g["id"] == generation_id:
                return g
        return None

    def delete_generation(self, generation_id: str) -> bool:
        with self._lock:
            for i, g in enumerate(self._data["generations"]):
                if g["id"] == generation_id:
                    self._data["generations"].pop(i)
                    gen_dir = GENERATIONS_DIR / generation_id
                    if gen_dir.exists():
                        shutil.rmtree(gen_dir)
                    self._save_unlocked()
                    return True
        return False

    # -- Transcriptions --

    def add_transcription(
        self,
        text: str,
        model: str,
        audio_path: str,
        duration: float,
        elapsed_seconds: float = 0.0,
        transcription_id: Optional[str] = None,
    ) -> dict:
        transcription_id = transcription_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        transcription = {
            "id": transcription_id,
            "text": text,
            "model": model,
            "audio_path": audio_path,
            "duration": duration,
            "elapsed_seconds": round(elapsed_seconds, 1),
            "created_at": now,
        }
        with self._lock:
            self._data["transcriptions"].append(transcription)
            self._save_unlocked()
        return transcription

    def list_transcriptions(self) -> List[dict]:
        return sorted(
            self._data.get("transcriptions", []),
            key=lambda t: t["created_at"],
            reverse=True,
        )

    def get_transcription(self, transcription_id: str) -> Optional[dict]:
        for t in self._data.get("transcriptions", []):
            if t["id"] == transcription_id:
                return t
        return None

    def delete_transcription(self, transcription_id: str) -> bool:
        with self._lock:
            transcriptions = self._data.get("transcriptions", [])
            for i, t in enumerate(transcriptions):
                if t["id"] == transcription_id:
                    transcriptions.pop(i)
                    trans_dir = TRANSCRIPTIONS_DIR / transcription_id
                    if trans_dir.exists():
                        shutil.rmtree(trans_dir)
                    self._save_unlocked()
                    return True
        return False


profile_store = ProfileStore()
