"""
TTS engine abstractions.

BaseTTSEngine  — common interface for all engine implementations.
HabibiEngine   — HabibiTTS-backed engine (Arabic dialects via F5-TTS).
"""

import abc
import os
import re
import uuid
import logging
import tempfile
import threading
from pathlib import Path

import numpy as np
import soundfile as sf

from app.config import GENERATIONS_DIR

logger = logging.getLogger(__name__)

MIN_REF_DURATION_SEC = 2.0
# HabibiTTS model context window is ~22 seconds total (ref + generated audio).
# F5-TTS docs recommend under 12s to leave room for generation in each chunk.
MAX_REF_DURATION_HABIBI = 12.0
# Silence appended to reference audio to prevent the last phrase from leaking
# into generated output (see F5-TTS issue #85).
TRAILING_SILENCE_SEC = 1.0
# Effective cap for speech content: after appending silence the total must
# stay within MAX_REF_DURATION_HABIBI.
_MAX_SPEECH_DURATION = MAX_REF_DURATION_HABIBI - TRAILING_SILENCE_SEC

# Arabic punctuation → Latin equivalents so chunk_text() can split properly.
# The upstream regex only splits on Latin/CJK punctuation, missing Arabic marks.
_ARABIC_PUNCT_MAP = str.maketrans({
    "\u060C": ",",   # ،  Arabic comma
    "\u061B": ";",   # ؛  Arabic semicolon
    "\u061F": "?",   # ؟  Arabic question mark
    "\u06D4": ".",   # ۔  Arabic full stop
})


def _normalize_arabic_punctuation(text: str) -> str:
    """Replace Arabic punctuation with Latin equivalents and ensure
    whitespace after punctuation so the upstream chunk_text() regex
    ``(?<=[;:,.!?])\\s+`` can split the text into proper batches."""
    text = text.translate(_ARABIC_PUNCT_MAP)
    # Ensure at least one space after sentence-ending punctuation
    text = re.sub(r"([;:,.!?])(?=\S)", r"\1 ", text)
    return text


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
        with self._lock:
            return self._loaded

    @property
    def loading_status(self) -> str:
        with self._lock:
            if self._loaded:
                return "ready"
            if self._error:
                return "error"
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

            vocoder_obj = load_vocoder(vocoder_name="vocos", is_local=False)
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
            model_obj = load_model(
                model_cls=DiT,
                model_cfg=model_arch,
                ckpt_path=ckpt_file,
                mel_spec_type="vocos",
                vocab_file=vocab_file,
            )

            with self._lock:
                self._vocoder = vocoder_obj
                self._model = model_obj
                self._loaded = True
                self._loading = False
            logger.info("HabibiEngine: model loaded successfully.")

        except Exception as exc:
            logger.error("HabibiEngine: failed to load model: %s", exc, exc_info=True)
            with self._lock:
                self._error = str(exc)
                self._loading = False

    def generate(
        self,
        ref_audio_path: str,
        ref_text: str,
        gen_text: str,
        dialect: str = "MSA",
        speed: float = 1.0,
        nfe_step: int = 32,
        cfg_strength: float = 2.0,
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
            Inference speed multiplier (default: 1.0).
        nfe_step : int
            Number of function evaluations / denoising steps (default: 32).
            Higher values produce better quality but take longer.
        cfg_strength : float
            Classifier-free guidance strength (default: 2.0).
            Higher values make the output follow the input text more closely.
        """
        with self._lock:
            if not self._loaded:
                raise RuntimeError("HabibiEngine is not loaded. Call start_loading() first.")
            model = self._model
            vocoder = self._vocoder

        import torch  # type: ignore
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

        # Trim reference audio if it exceeds the model's context window.
        # The HabibiTTS chunking formula uses (22 - ref_duration) which goes
        # negative for long audio, breaking text chunking completely.
        tmp_ref_audio_file = None

        if ref_duration > _MAX_SPEECH_DURATION:
            logger.warning(
                "HabibiEngine: ref audio (%.2fs) exceeds max (%.1fs), trimming",
                ref_duration,
                _MAX_SPEECH_DURATION,
            )
            max_samples = int(_MAX_SPEECH_DURATION * sr)
            audio_info = audio_info[:, :max_samples]

            # Proportionally trim reference text to match trimmed audio
            trim_ratio = _MAX_SPEECH_DURATION / ref_duration
            trimmed_len = max(10, int(len(ref_text) * trim_ratio))
            # Find the last word/sentence boundary within the trimmed range
            truncated = ref_text[:trimmed_len]
            for sep in (" ", ".", "،", "؟", "!", ","):
                last_break = truncated.rfind(sep)
                if last_break > trimmed_len // 2:
                    truncated = truncated[: last_break + 1].strip()
                    break
            ref_text = truncated
            logger.info(
                "HabibiEngine: trimmed ref to %.1fs, ref_text_len=%d",
                _MAX_SPEECH_DURATION,
                len(ref_text),
            )

        # Append trailing silence to prevent the last phrase of ref_text
        # from leaking into generated output (F5-TTS issue #85).
        silence_samples = int(TRAILING_SILENCE_SEC * sr)
        silence = torch.zeros(audio_info.shape[0], silence_samples, dtype=audio_info.dtype)
        audio_info = torch.cat([audio_info, silence], dim=-1)

        try:
            # Write modified audio (with silence appended) to a temp file
            tmp_ref_audio_file = tempfile.NamedTemporaryFile(
                suffix=".wav", delete=False
            )
            tmp_ref_audio_file.close()
            torchaudio.save(tmp_ref_audio_file.name, audio_info, sr)
            effective_ref_path = tmp_ref_audio_file.name

            # Ensure ref_text ends with "." so the model recognises the
            # boundary between reference and generated speech.
            if ref_text and not ref_text.rstrip().endswith((".", "!", "?", "؟")):
                ref_text = ref_text.rstrip() + "."

            ref_audio, ref_text_processed = preprocess_ref_audio_text(
                effective_ref_path, ref_text
            )

            dialect_id = dialect_id_map.get(dialect, dialect_id_map.get("UNK"))

            # Normalize Arabic punctuation so upstream chunk_text() can split
            # long text into batches that fit the model's ~22s context window.
            gen_text = _normalize_arabic_punctuation(gen_text)

            # Prepend a space so the model cleanly separates ref from gen text.
            if gen_text and not gen_text.startswith(" "):
                gen_text = " " + gen_text

            logger.info(
                "HabibiEngine: generating — dialect=%s speed=%.2f "
                "nfe_step=%d cfg_strength=%.2f "
                "ref_text_len=%d gen_text_len=%d",
                dialect,
                speed,
                nfe_step,
                cfg_strength,
                len(ref_text_processed),
                len(gen_text),
            )

            audio_data, final_sample_rate, _ = infer_process(
                ref_audio,
                ref_text_processed,
                gen_text,
                model,
                vocoder,
                dialect_id=dialect_id,
                speed=speed,
                nfe_step=nfe_step,
                cfg_strength=cfg_strength,
            )

            return self._save_audio(audio_data, final_sample_rate)
        finally:
            # Clean up temporary audio file
            if tmp_ref_audio_file is not None:
                try:
                    os.unlink(tmp_ref_audio_file.name)
                except OSError:
                    pass

    def unload(self) -> None:
        """Release model and vocoder references so memory can be reclaimed."""
        with self._lock:
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
