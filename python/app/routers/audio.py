import logging

import numpy as np
import soundfile as sf
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

from app.config import PROFILES_DIR, GENERATIONS_DIR, TRANSCRIPTIONS_DIR

router = APIRouter(tags=["audio"])


def _safe_path(base: Path, *parts: str) -> Path:
    """Resolve *parts* relative to *base* and verify the result stays inside it."""
    resolved = (base / Path(*parts)).resolve()
    if not resolved.is_relative_to(base.resolve()):
        raise HTTPException(status_code=400, detail="Invalid path")
    return resolved


@router.get("/audio/profiles/{profile_id}/{filename}")
async def serve_profile_audio(profile_id: str, filename: str):
    file_path = _safe_path(PROFILES_DIR, profile_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/generations/{generation_id}/{filename}")
async def serve_generation_audio(generation_id: str, filename: str):
    file_path = _safe_path(GENERATIONS_DIR, generation_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/transcriptions/{transcription_id}/{filename}")
async def serve_transcription_audio(transcription_id: str, filename: str):
    file_path = _safe_path(TRANSCRIPTIONS_DIR, transcription_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/waveform/{audio_type}/{item_id}/{filename}")
async def get_waveform(audio_type: str, item_id: str, filename: str):
    if audio_type == "profiles":
        base_dir = PROFILES_DIR
    elif audio_type == "generations":
        base_dir = GENERATIONS_DIR
    elif audio_type == "transcriptions":
        base_dir = TRANSCRIPTIONS_DIR
    else:
        raise HTTPException(status_code=400, detail="Invalid audio type")

    file_path = _safe_path(base_dir, item_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    try:
        data, sr = sf.read(str(file_path))
        if len(data.shape) > 1:
            data = data.mean(axis=1)

        # Downsample to ~500 points for visualization
        num_points = 500
        if len(data) > num_points:
            chunk_size = len(data) // num_points
            peaks = []
            for i in range(num_points):
                chunk = data[i * chunk_size : (i + 1) * chunk_size]
                peaks.append(float(np.max(np.abs(chunk))))
            waveform = peaks
        else:
            waveform = [float(abs(x)) for x in data]

        return {"waveform": waveform, "duration": len(data) / sr, "sample_rate": sr}
    except Exception as e:
        logger.error("Failed to extract waveform for %s/%s/%s: %s", audio_type, item_id, filename, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to extract waveform.")
