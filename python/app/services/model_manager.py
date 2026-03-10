"""
ModelManager — tracks download status and manages which engine is active.

Only one engine is kept loaded in memory at a time. The manager owns the
singleton HabibiEngine and QwenEngine instances and orchestrates switching
between them when a profile requests a different model.
"""

import json
import logging
import threading
from pathlib import Path
from typing import Dict, Optional, Any

from app.config import DATA_DIR

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static model registry
# ---------------------------------------------------------------------------

MODELS: Dict[str, Dict[str, Any]] = {
    "habibi-tts": {
        "name": "HabibiTTS",
        "description": "Arabic dialect TTS with 12 dialect support",
        "languages": ["Arabic"],
        "size_mb": 800,
        "pip_package": "habibi-tts",
    },
    "qwen3-tts": {
        "name": "Qwen3-TTS 1.7B",
        "description": "Multilingual TTS with voice cloning",
        "languages": [
            "English", "Chinese", "Japanese", "Korean", "German",
            "French", "Russian", "Portuguese", "Spanish", "Italian",
        ],
        "size_mb": 3400,
        "pip_package": "qwen-tts",
    },
}

# Path where per-model download state is persisted
_MODELS_STATE_FILE = DATA_DIR / "models.json"

# Valid download-state values stored on disk
_STATE_NOT_DOWNLOADED = "not_downloaded"
_STATE_DOWNLOADING = "downloading"
_STATE_DOWNLOADED = "downloaded"
_STATE_ERROR = "error"


class ModelManager:
    """
    Central registry for model availability and the currently-loaded engine.

    Thread-safety notes
    -------------------
    * ``_state_lock`` protects reads/writes to ``_download_state`` and the
      on-disk JSON file.
    * ``_engine_lock`` protects ``_active_engine_id`` and the load / unload
      lifecycle of engine instances.
    """

    def __init__(self):
        self._state_lock = threading.Lock()
        self._engine_lock = threading.Lock()

        # Persisted per-model download state  { model_id -> dict }
        self._download_state: Dict[str, Dict[str, Any]] = {}
        self._load_state()

        # Lazily imported engine instances (None until first use)
        self._engines: Dict[str, Any] = {}
        self._active_engine_id: Optional[str] = None

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _load_state(self) -> None:
        """Load persisted download state from disk; fill missing entries."""
        if _MODELS_STATE_FILE.exists():
            try:
                with open(_MODELS_STATE_FILE, "r", encoding="utf-8") as fh:
                    self._download_state = json.load(fh)
                logger.info("Loaded model state from %s", _MODELS_STATE_FILE)
            except Exception as exc:
                logger.warning("Could not read models state file: %s", exc)
                self._download_state = {}

        # Ensure every registered model has an entry
        for model_id in MODELS:
            if model_id not in self._download_state:
                self._download_state[model_id] = {
                    "download_status": _STATE_NOT_DOWNLOADED,
                    "download_progress": 0,
                    "error": None,
                }

        self._persist_state()

    def _persist_state(self) -> None:
        """Write current download state to disk (must be called under _state_lock)."""
        try:
            _MODELS_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(_MODELS_STATE_FILE, "w", encoding="utf-8") as fh:
                json.dump(self._download_state, fh, ensure_ascii=False, indent=2)
        except Exception as exc:
            logger.error("Failed to persist model state: %s", exc)

    # ------------------------------------------------------------------
    # Engine factory
    # ------------------------------------------------------------------

    def _get_or_create_engine(self, model_id: str):
        """Return the engine instance for *model_id*, creating it if needed."""
        if model_id not in self._engines:
            if model_id == "habibi-tts":
                from app.services.tts_engine import HabibiEngine
                self._engines[model_id] = HabibiEngine()
            elif model_id == "qwen3-tts":
                from app.services.qwen_engine import QwenEngine
                self._engines[model_id] = QwenEngine()
            else:
                raise ValueError(f"Unknown model_id: {model_id!r}")
        return self._engines[model_id]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list_models(self) -> list:
        """
        Return a list of dicts combining the static registry with runtime state.
        Each entry includes:
          id, name, description, languages, size_mb, pip_package,
          download_status, download_progress, loaded
        """
        result = []
        with self._state_lock:
            for model_id, meta in MODELS.items():
                state = self._download_state.get(model_id, {})
                engine_loaded = False
                engine_status = "idle"

                # If the engine object exists, query it without holding the engine lock
                # to avoid a nested-lock deadlock; the value is advisory only.
                engine = self._engines.get(model_id)
                if engine is not None:
                    engine_loaded = engine.is_loaded
                    engine_status = engine.loading_status

                result.append({
                    "id": model_id,
                    **meta,
                    "download_status": state.get("download_status", _STATE_NOT_DOWNLOADED),
                    "download_progress": state.get("download_progress", 0),
                    "download_error": state.get("error"),
                    "loaded": engine_loaded,
                    "engine_status": engine_status,
                })
        return result

    def get_model_status(self, model_id: str) -> Optional[dict]:
        """Return status for a single model, or None if the id is unknown."""
        if model_id not in MODELS:
            return None

        with self._state_lock:
            state = self._download_state.get(model_id, {})
            engine = self._engines.get(model_id)
            engine_loaded = engine.is_loaded if engine is not None else False
            engine_status = engine.loading_status if engine is not None else "idle"

            return {
                "id": model_id,
                **MODELS[model_id],
                "download_status": state.get("download_status", _STATE_NOT_DOWNLOADED),
                "download_progress": state.get("download_progress", 0),
                "download_error": state.get("error"),
                "loaded": engine_loaded,
                "engine_status": engine_status,
            }

    def start_download(self, model_id: str) -> bool:
        """
        Begin downloading *model_id* in a background thread.

        Returns False if the model is unknown or already downloading/downloaded.
        Returns True when the download thread has been started.
        """
        if model_id not in MODELS:
            logger.warning("start_download called for unknown model: %s", model_id)
            return False

        with self._state_lock:
            current = self._download_state[model_id]["download_status"]
            if current in (_STATE_DOWNLOADING, _STATE_DOWNLOADED):
                logger.info("Model %s is already %s — skipping download.", model_id, current)
                return False

            self._download_state[model_id]["download_status"] = _STATE_DOWNLOADING
            self._download_state[model_id]["download_progress"] = 0
            self._download_state[model_id]["error"] = None
            self._persist_state()

        thread = threading.Thread(
            target=self._download_model,
            args=(model_id,),
            daemon=True,
            name=f"download-{model_id}",
        )
        thread.start()
        logger.info("Download thread started for model: %s", model_id)
        return True

    def _download_model(self, model_id: str) -> None:
        """Background download worker."""
        logger.info("[download] Starting download for %s", model_id)
        try:
            if model_id == "habibi-tts":
                self._download_habibi()
            elif model_id == "qwen3-tts":
                self._download_qwen()
            else:
                raise ValueError(f"No download handler for model: {model_id!r}")

            with self._state_lock:
                self._download_state[model_id]["download_status"] = _STATE_DOWNLOADED
                self._download_state[model_id]["download_progress"] = 100
                self._download_state[model_id]["error"] = None
                self._persist_state()

            logger.info("[download] Completed download for %s", model_id)

        except Exception as exc:
            logger.error("[download] Failed to download %s: %s", model_id, exc, exc_info=True)
            with self._state_lock:
                self._download_state[model_id]["download_status"] = _STATE_ERROR
                self._download_state[model_id]["download_progress"] = 0
                self._download_state[model_id]["error"] = str(exc)
                self._persist_state()

    def _download_habibi(self) -> None:
        """Pull HabibiTTS checkpoint files via cached_path (HuggingFace Hub)."""
        logger.info("[download/habibi] Fetching model checkpoint…")
        from cached_path import cached_path  # type: ignore

        self._update_progress("habibi-tts", 20)
        cached_path("hf://SWivid/Habibi-TTS/Unified/model_200000.safetensors")
        self._update_progress("habibi-tts", 70)
        cached_path("hf://SWivid/Habibi-TTS/Unified/vocab.txt")
        self._update_progress("habibi-tts", 90)
        logger.info("[download/habibi] Checkpoint files cached successfully.")

    def _download_qwen(self) -> None:
        """Pull Qwen3-TTS weights from HuggingFace via from_pretrained."""
        logger.info("[download/qwen] Fetching Qwen3-TTS model weights…")
        try:
            import torch
            from qwen_tts import Qwen3TTSModel  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "qwen-tts package is not installed. "
                "Run: pip install qwen-tts>=0.1.0"
            ) from exc

        self._update_progress("qwen3-tts", 10)
        # Calling from_pretrained triggers the HuggingFace Hub download
        _model = Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            device_map="cpu",
            dtype=torch.float32,
        )
        self._update_progress("qwen3-tts", 90)
        # Release immediately; the engine will re-load when needed
        del _model
        logger.info("[download/qwen] Qwen3-TTS weights cached successfully.")

    def _update_progress(self, model_id: str, progress: int) -> None:
        with self._state_lock:
            self._download_state[model_id]["download_progress"] = progress
            self._persist_state()

    def delete_model(self, model_id: str) -> bool:
        """
        Unload and mark the model as not-downloaded.

        Note: this does NOT purge HuggingFace Hub cache files from disk because
        those paths are managed by the hub library.  What it does do is:
          * unload the engine from memory
          * reset the persisted download_status to not_downloaded
        """
        if model_id not in MODELS:
            return False

        with self._engine_lock:
            engine = self._engines.get(model_id)
            if engine is not None:
                try:
                    engine.unload()
                except Exception as exc:
                    logger.warning("Error unloading engine %s: %s", model_id, exc)
                del self._engines[model_id]

            if self._active_engine_id == model_id:
                self._active_engine_id = None

        with self._state_lock:
            self._download_state[model_id]["download_status"] = _STATE_NOT_DOWNLOADED
            self._download_state[model_id]["download_progress"] = 0
            self._download_state[model_id]["error"] = None
            self._persist_state()

        logger.info("Model %s unloaded and marked as not_downloaded.", model_id)
        return True

    def get_engine_for_model(self, model_id: str):
        """
        Return the engine for *model_id*, loading it if necessary and unloading
        any other currently-active engine first.

        Raises ValueError if model_id is unknown.
        Raises RuntimeError if the model has not been downloaded yet.
        """
        if model_id not in MODELS:
            raise ValueError(f"Unknown model: {model_id!r}")

        with self._engine_lock:
            # Unload the other engine if a different one is active
            if self._active_engine_id and self._active_engine_id != model_id:
                other = self._engines.get(self._active_engine_id)
                if other is not None and other.is_loaded:
                    logger.info(
                        "Unloading %s to make room for %s",
                        self._active_engine_id,
                        model_id,
                    )
                    other.unload()

            engine = self._get_or_create_engine(model_id)

            if not engine.is_loaded and engine.loading_status not in ("loading", "not_installed"):
                # Check that the model has been downloaded before attempting to load
                with self._state_lock:
                    dl_status = self._download_state.get(model_id, {}).get(
                        "download_status", _STATE_NOT_DOWNLOADED
                    )
                if dl_status != _STATE_DOWNLOADED:
                    raise RuntimeError(
                        f"Model '{model_id}' has not been downloaded yet "
                        f"(status: {dl_status}). "
                        "Call POST /api/models/{model_id}/download first."
                    )
                engine.start_loading()

            self._active_engine_id = model_id
            return engine

    @property
    def active_engine_id(self) -> Optional[str]:
        return self._active_engine_id

    def any_model_loaded(self) -> bool:
        """Return True if at least one engine is currently loaded."""
        return any(e.is_loaded for e in self._engines.values())


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

model_manager = ModelManager()
