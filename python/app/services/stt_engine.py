"""
Speech-to-Text engine using OpenAI Whisper models via HuggingFace Transformers.

Uses the model and processor directly (not the pipeline) to avoid torchcodec
dependency issues. Audio is loaded with librosa.

Supports multiple model sizes so users can trade off quality vs. speed/memory.
The engine lazily loads the selected model on first transcription request and
can switch between models at runtime.
"""

import logging
import threading
from typing import Optional

import librosa
import torch
from huggingface_hub import scan_cache_dir, snapshot_download  # type: ignore
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor  # type: ignore

logger = logging.getLogger(__name__)

# Supported Whisper models (id -> display metadata)
WHISPER_MODELS = [
    {
        "id": "openai/whisper-tiny",
        "name": "Whisper Tiny",
        "size_mb": 150,
        "description": "Very fast, basic quality — good for quick drafts or limited RAM",
    },
    {
        "id": "openai/whisper-base",
        "name": "Whisper Base",
        "size_mb": 290,
        "description": "Fast with good quality — recommended for low-resource machines",
    },
    {
        "id": "openai/whisper-small",
        "name": "Whisper Small",
        "size_mb": 960,
        "description": "Balanced speed and quality",
    },
    {
        "id": "openai/whisper-large-v3-turbo",
        "name": "Whisper Large V3 Turbo",
        "size_mb": 1500,
        "description": "Best accuracy, requires more memory",
    },
]

WHISPER_MODEL_IDS = {m["id"] for m in WHISPER_MODELS}
DEFAULT_MODEL = "openai/whisper-large-v3-turbo"

WHISPER_SAMPLE_RATE = 16000
# Maximum audio length per chunk in seconds
CHUNK_LENGTH_S = 30


def _detect_device() -> str:
    """Pick the best available device."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class STTEngine:
    """
    Thread-safe Whisper-based speech-to-text engine.

    Uses AutoModelForSpeechSeq2Seq + AutoProcessor directly to bypass the
    pipeline's torchcodec dependency.

    Usage::

        engine = STTEngine()
        text = engine.transcribe("/path/to/audio.wav")
        # First call triggers model download + load
    """

    def __init__(self):
        self._model = None
        self._processor = None
        self._current_model: Optional[str] = None
        self._device: Optional[str] = None
        self._dtype = torch.float32
        self._loading = False
        self._error: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def current_model(self) -> Optional[str]:
        return self._current_model

    @property
    def loading_status(self) -> str:
        if self._model is not None:
            return "ready"
        if self._error:
            return f"error: {self._error}"
        if self._loading:
            return "loading"
        return "idle"

    def load(self, model_id: str = DEFAULT_MODEL) -> None:
        """
        Load a Whisper model. If a different model is already loaded, unload
        it first. Thread-safe.
        """
        if model_id not in WHISPER_MODEL_IDS:
            raise ValueError(
                f"Unknown model '{model_id}'. "
                f"Supported: {', '.join(sorted(WHISPER_MODEL_IDS))}"
            )

        with self._lock:
            if self._current_model == model_id and self._model is not None:
                return  # already loaded
            if self._loading:
                return

            # Unload any existing model
            if self._model is not None:
                logger.info("STTEngine: unloading %s before loading %s", self._current_model, model_id)
                self._model = None
                self._processor = None
                self._current_model = None

            self._loading = True
            self._error = None

        try:
            device = _detect_device()
            dtype = torch.float32
            if device == "cuda":
                props = torch.cuda.get_device_properties(device)
                if props.major >= 7:
                    dtype = torch.float16

            logger.info("STTEngine: loading %s on %s (dtype=%s)...", model_id, device, dtype)

            processor = AutoProcessor.from_pretrained(model_id)
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
            ).to(device)

            with self._lock:
                self._model = model
                self._processor = processor
                self._current_model = model_id
                self._device = device
                self._dtype = dtype
                self._loading = False

            logger.info("STTEngine: %s loaded successfully.", model_id)

        except Exception as exc:
            logger.error("STTEngine: failed to load %s: %s", model_id, exc, exc_info=True)
            with self._lock:
                self._error = str(exc)
                self._loading = False
            raise

    def transcribe(self, audio_path: str, language: Optional[str] = None, model_id: Optional[str] = None) -> str:
        """
        Transcribe an audio file to text.

        Parameters
        ----------
        audio_path : str
            Path to the audio file (WAV, MP3, WebM, etc.).
        language : str, optional
            Language hint for Whisper (e.g., "arabic", "english").
        model_id : str, optional
            If provided and different from the currently loaded model,
            switches to this model first.

        Returns
        -------
        str
            The transcribed text.
        """
        target_model = model_id or self._current_model or DEFAULT_MODEL

        # Load or switch model if needed
        if self._model is None or self._current_model != target_model:
            self.load(target_model)

        logger.info("STTEngine: transcribing %s (model=%s, language=%s)", audio_path, self._current_model, language)

        # Snapshot references under lock so inference is thread-safe
        with self._lock:
            model = self._model
            processor = self._processor
            device = self._device
            dtype = self._dtype

        if model is None or processor is None:
            raise RuntimeError("STT model failed to load. Check logs for details.")

        # Load audio with librosa (avoids torchcodec/FFmpeg issues)
        audio_array, _ = librosa.load(audio_path, sr=WHISPER_SAMPLE_RATE, mono=True)

        # Process in chunks for long audio
        total_samples = len(audio_array)
        chunk_samples = CHUNK_LENGTH_S * WHISPER_SAMPLE_RATE
        all_text_parts = []

        for start in range(0, total_samples, chunk_samples):
            chunk = audio_array[start : start + chunk_samples]

            # Prepare input features
            inputs = processor(
                chunk,
                sampling_rate=WHISPER_SAMPLE_RATE,
                return_tensors="pt",
            )
            input_features = inputs.input_features.to(device, dtype=dtype)

            # Build generate kwargs
            gen_kwargs = {}
            if language:
                gen_kwargs["language"] = language
            gen_kwargs["task"] = "transcribe"

            # Generate token ids
            with torch.no_grad():
                predicted_ids = model.generate(
                    input_features,
                    **gen_kwargs,
                )

            # Decode tokens to text
            text = processor.batch_decode(predicted_ids, skip_special_tokens=True)
            all_text_parts.extend(text)

        result = " ".join(part.strip() for part in all_text_parts if part.strip())
        logger.info("STTEngine: transcription complete (%d chars)", len(result))
        return result

    def unload(self) -> None:
        """Release the model from memory."""
        with self._lock:
            was_cuda = self._device == "cuda"
            self._model = None
            self._processor = None
            self._current_model = None
            self._device = None
            self._loading = False
            self._error = None
        if was_cuda:
            torch.cuda.empty_cache()
        logger.info("STTEngine: unloaded.")

    # ------------------------------------------------------------------
    # Download management
    # ------------------------------------------------------------------

    @staticmethod
    def is_model_downloaded(model_id: str) -> bool:
        """Check if a Whisper model is already in the HuggingFace cache."""
        try:
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == model_id and repo.size_on_disk > 1_000_000:
                    return True
        except Exception:
            pass
        return False

    @staticmethod
    def download_model(model_id: str) -> None:
        """
        Pre-download a Whisper model to the HuggingFace cache.

        This is a blocking call that downloads all required files. Run it
        in a background thread to avoid blocking the event loop.
        """
        if model_id not in WHISPER_MODEL_IDS:
            raise ValueError(f"Unknown model '{model_id}'")

        logger.info("STTEngine: downloading %s...", model_id)
        snapshot_download(repo_id=model_id)
        logger.info("STTEngine: %s downloaded.", model_id)

    @staticmethod
    def delete_model(model_id: str) -> None:
        """
        Remove a Whisper model from the HuggingFace cache.
        """
        try:
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == model_id:
                    revisions_to_delete = [rev.commit_hash for rev in repo.revisions]
                    delete_strategy = cache_info.delete_revisions(*revisions_to_delete)
                    delete_strategy.execute()
                    logger.info("STTEngine: deleted %s from cache.", model_id)
                    return
        except Exception as exc:
            logger.error("STTEngine: failed to delete %s: %s", model_id, exc)
            raise

    def get_models_status(self) -> list[dict]:
        """Return all STT models with their download/loaded status."""
        results = []
        for m in WHISPER_MODELS:
            downloaded = self.is_model_downloaded(m["id"])
            loaded = self._current_model == m["id"] and self._model is not None
            results.append({
                **m,
                "status": "loaded" if loaded else "downloaded" if downloaded else "not_downloaded",
            })
        return results


# Module-level singleton
stt_engine = STTEngine()
