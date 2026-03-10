import numpy as np
import soundfile as sf
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import PROFILES_DIR, GENERATIONS_DIR

router = APIRouter(tags=["audio"])


@router.get("/audio/profiles/{profile_id}/{filename}")
async def serve_profile_audio(profile_id: str, filename: str):
    file_path = PROFILES_DIR / profile_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/generations/{generation_id}/{filename}")
async def serve_generation_audio(generation_id: str, filename: str):
    file_path = GENERATIONS_DIR / generation_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@router.get("/audio/waveform/{audio_type}/{item_id}/{filename}")
async def get_waveform(audio_type: str, item_id: str, filename: str):
    if audio_type == "profiles":
        base_dir = PROFILES_DIR
    elif audio_type == "generations":
        base_dir = GENERATIONS_DIR
    else:
        raise HTTPException(status_code=400, detail="Invalid audio type")

    file_path = base_dir / item_id / filename
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
        raise HTTPException(status_code=500, detail=f"Failed to extract waveform: {str(e)}")
