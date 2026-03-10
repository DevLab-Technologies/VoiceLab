"""
QwenEngine — Qwen3-TTS 1.7B backend with voice cloning support.

The engine wraps the ``qwen-tts`` pip package.  If the package is not
installed the engine reports "not_installed" as its status rather than
crashing the application.
"""

import logging
import threading
import uuid
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import GENERATIONS_DIR
from app.services.tts_engine import BaseTTSEngine, MIN_REF_DURATION_SEC

logger = logging.getLogger(__name__)

# HuggingFace Hub model identifier for Qwen3-TTS
_QWEN_MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

# Languages supported by the Qwen3-TTS model
SUPPORTED_LANGUAGES = [
    "English", "Chinese", "Japanese", "Korean", "German",
    "French", "Russian", "Portuguese", "Spanish", "Italian",
]


def _qwen_tts_available() -> bool:
    """Return True when the qwen-tts package can be imported."""
    try:
        import qwen_tts  # type: ignore  # noqa: F401
        return True
    except ImportError:
        return False


class QwenEngine(BaseTTSEngine):
    """
    TTS engine backed by Qwen3-TTS 1.7B.

    Voice cloning is performed by passing a reference WAV and its transcript
    to ``model.generate_voice_clone()``.  The output is saved as a WAV file
    under GENERATIONS_DIR.
    """

    def __init__(self):
        self._model = None
        self._loaded: bool = False
        self._loading: bool = False
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
        if not _qwen_tts_available():
            return "not_installed"
        if self._loaded:
            return "ready"
        if self._error:
            return f"error: {self._error}"
        if self._loading:
            return "loading"
        return "idle"

    def start_loading(self) -> None:
        """Begin loading model weights in a background thread (non-blocking)."""
        if not _qwen_tts_available():
            logger.warning(
                "QwenEngine: qwen-tts package is not installed. "
                "Run: pip install 'qwen-tts>=0.1.0'"
            )
            return

        with self._lock:
            if self._loading or self._loaded:
                return
            self._loading = True

        thread = threading.Thread(
            target=self._load_sync,
            daemon=True,
            name="qwen-load",
        )
        thread.start()
        logger.info("QwenEngine: model loading started in background thread.")

    def _load_sync(self) -> None:
        """Synchronous model loading — runs in a background thread."""
        try:
            logger.info("[qwen 1/1] Loading Qwen3-TTS weights from HuggingFace cache…")
            import torch  # type: ignore
            from qwen_tts import Qwen3TTSModel  # type: ignore

            # Select the best available device
            if torch.cuda.is_available():
                device_map = "auto"
            else:
                # MPS is preferred on Apple Silicon; fall back to CPU
                try:
                    if torch.backends.mps.is_available():
                        device_map = "mps"
                    else:
                        device_map = "cpu"
                except AttributeError:
                    device_map = "cpu"

            logger.info("QwenEngine: using device_map=%s", device_map)

            self._model = Qwen3TTSModel.from_pretrained(
                _QWEN_MODEL_ID,
                device_map=device_map,
                dtype=torch.float32,
            )

            self._loaded = True
            self._loading = False
            logger.info("QwenEngine: model loaded successfully.")

        except Exception as exc:
            logger.error("QwenEngine: failed to load model: %s", exc, exc_info=True)
            self._error = str(exc)
            self._loading = False

    def generate(
        self,
        ref_audio_path: str,
        ref_text: str,
        gen_text: str,
        language: str = "English",
        **kwargs,
    ) -> dict:
        """
        Run Qwen3-TTS inference with voice cloning synchronously.

        Parameters
        ----------
        ref_audio_path : str
            Path to the reference WAV file.
        ref_text : str
            Transcript of the reference audio (used for voice cloning).
        gen_text : str
            Text to synthesise.
        language : str
            Target language name (e.g. "English", "Arabic").  Defaults to
            "English".
        """
        if not self._loaded:
            raise RuntimeError("QwenEngine is not loaded. Call start_loading() first.")

        if not _qwen_tts_available():
            raise RuntimeError(
                "qwen-tts package is not installed. "
                "Run: pip install 'qwen-tts>=0.1.0'"
            )

        # Validate reference audio duration
        try:
            import torchaudio  # type: ignore
            audio_info, sr = torchaudio.load(ref_audio_path)
            ref_duration = audio_info.shape[-1] / sr
        except Exception:
            import soundfile as _sf
            data, sr = _sf.read(ref_audio_path)
            ref_duration = len(data) / sr

        logger.info("QwenEngine: ref audio duration=%.2fs sr=%d", ref_duration, sr)
        if ref_duration < MIN_REF_DURATION_SEC:
            raise ValueError(
                f"Reference audio is too short ({ref_duration:.1f}s). "
                f"Please record at least {MIN_REF_DURATION_SEC:.0f} seconds."
            )

        logger.info(
            "QwenEngine: generating — language=%s ref_text_len=%d gen_text_len=%d",
            language,
            len(ref_text),
            len(gen_text),
        )

        wavs, sample_rate = self._model.generate_voice_clone(
            text=gen_text,
            language=language,
            ref_audio=ref_audio_path,
            ref_text=ref_text,
        )

        # Normalise output: accept torch.Tensor, numpy array, or list
        audio_data = self._to_numpy(wavs)

        return self._save_audio(audio_data, int(sample_rate))

    def unload(self) -> None:
        """Release model reference so memory can be reclaimed."""
        self._model = None
        self._loaded = False
        self._loading = False
        self._error = None
        logger.info("QwenEngine: unloaded.")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_numpy(wavs) -> np.ndarray:
        """
        Convert the model output to a flat 1-D float32 numpy array.

        Qwen3TTSModel.generate_voice_clone() returns
        ``Tuple[List[numpy.ndarray], int]`` — a list of waveform arrays (one
        per input text) and a sample rate.  We take the first item.
        """
        # Handle list output (one waveform per input text)
        if isinstance(wavs, (list, tuple)):
            wavs = wavs[0] if len(wavs) > 0 else wavs

        try:
            import torch  # type: ignore

            if isinstance(wavs, torch.Tensor):
                wavs = wavs.detach().cpu().numpy()
        except ImportError:
            pass

        audio = np.asarray(wavs, dtype=np.float32)
        return audio.flatten()

    @staticmethod
    def _save_audio(audio_data: np.ndarray, sample_rate: int) -> dict:
        """Persist *audio_data* under GENERATIONS_DIR and return a result dict."""
        gen_id = str(uuid.uuid4())
        out_dir = GENERATIONS_DIR / gen_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "output.wav"

        sf.write(str(out_path), audio_data, sample_rate)

        duration = len(audio_data) / sample_rate
        rms = float(np.sqrt(np.mean(audio_data ** 2)))
        logger.info(
            "QwenEngine: saved generation %s duration=%.2fs rms=%.4f",
            gen_id,
            duration,
            rms,
        )

        return {
            "id": gen_id,
            "audio_path": str(out_path),
            "duration": round(duration, 2),
        }
