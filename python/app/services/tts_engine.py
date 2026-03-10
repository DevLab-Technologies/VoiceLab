"""
TTS engine abstractions.

BaseTTSEngine  — common interface for all engine implementations.
HabibiEngine   — HabibiTTS-backed engine (Arabic dialects via F5-TTS).
"""

import abc
import uuid
import logging
import threading
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import GENERATIONS_DIR

logger = logging.getLogger(__name__)

MIN_REF_DURATION_SEC = 2.0


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseTTSEngine(abc.ABC):
    """
    Common interface every TTS backend must implement.

    Lifecycle
    ---------
    1. Instantiate (cheap — no model weights loaded yet).
    2. Call ``start_loading()`` to begin weight loading in a background thread.
    3. Poll ``is_loaded`` / ``loading_status`` until ``is_loaded`` is True.
    4. Call ``generate()`` to run inference.
    5. Call ``unload()`` to release GPU/CPU memory.
    """

    @property
    @abc.abstractmethod
    def is_loaded(self) -> bool:
        """True when the model weights are in memory and ready for inference."""

    @property
    @abc.abstractmethod
    def loading_status(self) -> str:
        """
        Human-readable status string.
        Typical values: "idle", "loading", "ready", "error: <msg>", "not_installed"
        """

    @abc.abstractmethod
    def start_loading(self) -> None:
        """Begin loading model weights in a background thread (non-blocking)."""

    @abc.abstractmethod
    def generate(
        self,
        ref_audio_path: str,
        ref_text: str,
        gen_text: str,
        **kwargs,
    ) -> dict:
        """
        Run synchronous TTS inference.  Must be called from asyncio.to_thread().

        Returns
        -------
        dict with keys:
            id          — unique generation UUID string
            audio_path  — absolute path to the saved WAV file
            duration    — duration of the generated audio in seconds (float)
        """

    @abc.abstractmethod
    def unload(self) -> None:
        """Release model weights from memory."""


# ---------------------------------------------------------------------------
# HabibiTTS implementation
# ---------------------------------------------------------------------------

class HabibiEngine(BaseTTSEngine):
    """
    Wraps the HabibiTTS model (built on F5-TTS) for Arabic dialect synthesis.

    The model loads in a background thread so the FastAPI application stays
    responsive.  Call ``start_loading()`` once; the engine sets ``_loaded``
    when complete.
    """

    def __init__(self):
        self._loaded: bool = False
        self._loading: bool = False
        self._model = None
        self._vocoder = None
        self._error: str | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # BaseTTSEngine interface
    # ------------------------------------------------------------------

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def loading_status(self) -> str:
        if self._loaded:
            return "ready"
        if self._error:
            return f"error: {self._error}"
        if self._loading:
            return "loading"
        return "idle"

    def start_loading(self) -> None:
        """Kick off model loading in a background thread (non-blocking)."""
        with self._lock:
            if self._loading or self._loaded:
                return
            self._loading = True

        thread = threading.Thread(
            target=self._load_sync,
            daemon=True,
            name="habibi-load",
        )
        thread.start()
        logger.info("HabibiEngine: model loading started in background thread.")

    def _load_sync(self) -> None:
        """Synchronous model loading — runs in a background thread."""
        try:
            logger.info("[habibi 1/3] Loading vocoder…")
            from f5_tts.infer.utils_infer import load_vocoder, load_model  # type: ignore
            from f5_tts.model import DiT  # type: ignore

            self._vocoder = load_vocoder(vocoder_name="vocos", is_local=False)
            logger.info("[habibi 1/3] Vocoder loaded.")

            logger.info("[habibi 2/3] Downloading model checkpoint (first run only)…")
            from cached_path import cached_path  # type: ignore

            ckpt_file = str(cached_path("hf://SWivid/Habibi-TTS/Unified/model_200000.safetensors"))
            vocab_file = str(cached_path("hf://SWivid/Habibi-TTS/Unified/vocab.txt"))
            logger.info("[habibi 2/3] Checkpoint ready.")

            logger.info("[habibi 3/3] Loading model into memory…")
            model_arch = dict(
                dim=1024,
                depth=22,
                heads=16,
                ff_mult=2,
                text_dim=512,
                text_mask_padding=True,
                qk_norm=None,
                conv_layers=4,
                pe_attn_head=None,
                attn_backend="torch",
                attn_mask_enabled=False,
                checkpoint_activations=False,
            )
            self._model = load_model(
                model_cls=DiT,
                model_cfg=model_arch,
                ckpt_path=ckpt_file,
                mel_spec_type="vocos",
                vocab_file=vocab_file,
            )

            self._loaded = True
            self._loading = False
            logger.info("HabibiEngine: model loaded successfully.")

        except Exception as exc:
            logger.error("HabibiEngine: failed to load model: %s", exc, exc_info=True)
            self._error = str(exc)
            self._loading = False

    def generate(
        self,
        ref_audio_path: str,
        ref_text: str,
        gen_text: str,
        dialect: str = "MSA",
        speed: float = 0.8,
        **kwargs,
    ) -> dict:
        """
        Run HabibiTTS inference synchronously.

        Parameters
        ----------
        ref_audio_path : str
            Path to the reference WAV file used for voice cloning.
        ref_text : str
            Transcript of the reference audio.
        gen_text : str
            Arabic text to synthesise.
        dialect : str
            One of the HabibiTTS dialect codes (default: "MSA").
        speed : float
            Inference speed multiplier (default: 0.8).
        """
        if not self._loaded:
            raise RuntimeError("HabibiEngine is not loaded. Call start_loading() first.")

        import torchaudio  # type: ignore
        from f5_tts.infer.utils_infer import preprocess_ref_audio_text  # type: ignore
        from habibi_tts.infer.utils_infer import infer_process  # type: ignore
        from habibi_tts.model.utils import dialect_id_map  # type: ignore

        # Validate reference audio duration
        audio_info, sr = torchaudio.load(ref_audio_path)
        ref_duration = audio_info.shape[-1] / sr
        logger.info(
            "HabibiEngine: ref audio duration=%.2fs sr=%d", ref_duration, sr
        )
        if ref_duration < MIN_REF_DURATION_SEC:
            raise ValueError(
                f"Reference audio is too short ({ref_duration:.1f}s). "
                f"Please record at least {MIN_REF_DURATION_SEC:.0f} seconds."
            )

        ref_audio, ref_text_processed = preprocess_ref_audio_text(
            ref_audio_path, ref_text
        )

        dialect_id = dialect_id_map.get(dialect, dialect_id_map.get("UNK"))

        logger.info(
            "HabibiEngine: generating — dialect=%s speed=%.2f "
            "ref_text_len=%d gen_text_len=%d",
            dialect,
            speed,
            len(ref_text_processed),
            len(gen_text),
        )

        audio_data, final_sample_rate, _ = infer_process(
            ref_audio,
            ref_text_processed,
            gen_text,
            self._model,
            self._vocoder,
            dialect_id=dialect_id,
            speed=speed,
        )

        return self._save_audio(audio_data, final_sample_rate)

    def unload(self) -> None:
        """Release model and vocoder references so memory can be reclaimed."""
        self._model = None
        self._vocoder = None
        self._loaded = False
        self._loading = False
        self._error = None
        logger.info("HabibiEngine: unloaded.")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _save_audio(audio_data, sample_rate: int) -> dict:
        """Save *audio_data* to GENERATIONS_DIR and return a result dict."""
        gen_id = str(uuid.uuid4())
        out_dir = GENERATIONS_DIR / gen_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "output.wav"

        sf.write(str(out_path), audio_data, sample_rate)

        duration = len(audio_data) / sample_rate
        rms = float(np.sqrt(np.mean(audio_data ** 2)))
        logger.info(
            "HabibiEngine: saved generation %s duration=%.2fs rms=%.4f",
            gen_id,
            duration,
            rms,
        )

        return {
            "id": gen_id,
            "audio_path": str(out_path),
            "duration": round(duration, 2),
        }


# ---------------------------------------------------------------------------
# Module-level singleton (kept for backward compatibility)
# ---------------------------------------------------------------------------

# This instance is used by the health router and legacy code.
# The model manager creates its own HabibiEngine instance; this singleton
# remains so existing import paths do not break during the transition.
tts_engine = HabibiEngine()
