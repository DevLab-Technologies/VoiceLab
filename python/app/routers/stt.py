"""
Speech-to-Text router — handles audio transcription requests.

Provides endpoints for transcribing audio files using Whisper models,
listing available model options, managing model downloads, and
persisting transcription history.
"""

import asyncio
import logging
import shutil
import subprocess
import tempfile
import time
import uuid as _uuid
from pathlib import Path
from typing import Optional

import soundfile as sf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import TRANSCRIPTIONS_DIR
from app.services.profile_store import _safe_subdir, profile_store
from app.services.stt_engine import stt_engine, WHISPER_MODEL_IDS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stt"])

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


@router.post("/stt/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
    model: Optional[str] = Form(default=None),
    save: bool = Form(default=False),
):
    """
    Transcribe an uploaded audio file to text using Whisper.

    Parameters
    ----------
    audio : UploadFile
        Audio file (WAV, MP3, WebM, etc.).
    language : str, optional
        Language hint (e.g., "arabic", "english"). If omitted, Whisper
        auto-detects the language.
    model : str, optional
        Whisper model ID to use (e.g., "openai/whisper-tiny"). If omitted,
        uses the currently loaded model or the default.
    save : bool
        True to persist the transcription to history. Defaults to False.

    Returns
    -------
    When save=false: dict with keys ``text`` and ``model``.
    When save=true: full transcription record with id, text, model, duration,
                    elapsed_seconds, created_at.
    """

    # Save uploaded file to a temp location
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
    content = await audio.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum upload size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = tmp.name
            tmp.write(content)
    except Exception as exc:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass
            tmp_path = None
        logger.error("Failed to save uploaded audio: %s", exc)
        raise HTTPException(status_code=400, detail="Failed to process uploaded audio file.")

    try:
        start_time = time.time()
        text = await asyncio.to_thread(
            stt_engine.transcribe,
            audio_path=tmp_path,
            language=language,
            model_id=model,
        )
        elapsed = time.time() - start_time

        if not save:
            return {
                "text": text,
                "model": stt_engine.current_model,
            }

        # Save mode: persist source audio and transcription record
        transcription_id = str(_uuid.uuid4())
        trans_dir = _safe_subdir(TRANSCRIPTIONS_DIR, transcription_id)
        trans_dir.mkdir(parents=True, exist_ok=True)

        # Convert source audio to WAV for consistent playback
        dest_audio = trans_dir / "source_audio.wav"
        convert_result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_path,
             "-ar", "16000", "-ac", "1", "-f", "wav", str(dest_audio)],
            capture_output=True, timeout=30,
        )
        if convert_result.returncode != 0:
            # Fall back to raw copy if ffmpeg unavailable
            shutil.copy2(tmp_path, str(dest_audio))

        # Get audio duration
        try:
            data, sr = sf.read(str(dest_audio))
            duration = len(data) / sr if sr > 0 else 0.0
        except Exception:
            duration = 0.0

        # Persist to data.json with the pre-generated id
        record = profile_store.add_transcription(
            text=text,
            model=stt_engine.current_model or (model or "unknown"),
            audio_path=str(dest_audio),
            duration=round(duration, 2),
            elapsed_seconds=elapsed,
            transcription_id=transcription_id,
        )

        return record
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("STT transcription failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Transcription failed. Check server logs for details.")
    finally:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass


@router.get("/stt/transcriptions")
async def list_transcriptions():
    """Return all saved transcriptions, newest first."""
    return profile_store.list_transcriptions()


@router.delete("/stt/transcriptions/{transcription_id}")
async def delete_transcription(transcription_id: str):
    """Delete a saved transcription and its audio file."""
    if not profile_store.delete_transcription(transcription_id):
        raise HTTPException(status_code=404, detail="Transcription not found")
    return {"status": "deleted"}


@router.get("/stt/models")
async def list_stt_models():
    """
    Return the list of available Whisper models with download/loaded status.
    """
    return await asyncio.to_thread(stt_engine.get_models_status)


@router.post("/stt/models/{model_id:path}/download")
async def download_stt_model(model_id: str):
    """
    Pre-download a Whisper model to the local cache.
    """
    if model_id not in WHISPER_MODEL_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown model '{model_id}'")

    if stt_engine.is_model_downloaded(model_id):
        return {"status": "already_downloaded"}

    try:
        await asyncio.to_thread(stt_engine.download_model, model_id)
    except Exception as exc:
        logger.error("Failed to download STT model %s: %s", model_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Download failed. Check server logs for details.")

    return {"status": "downloaded"}


@router.delete("/stt/models/{model_id:path}")
async def delete_stt_model(model_id: str):
    """
    Remove a Whisper model from the local cache.
    """
    if model_id not in WHISPER_MODEL_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown model '{model_id}'")

    # Unload if currently loaded
    if stt_engine.current_model == model_id:
        stt_engine.unload()

    try:
        await asyncio.to_thread(stt_engine.delete_model, model_id)
    except Exception as exc:
        logger.error("Failed to delete STT model %s: %s", model_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Delete failed. Check server logs for details.")

    return {"status": "deleted"}
