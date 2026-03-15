import shutil
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.youtube_service import (
    cleanup_temp_file,
    extract_audio,
    get_video_info,
)

router = APIRouter(prefix="/youtube", tags=["youtube"])


class YouTubeURLRequest(BaseModel):
    url: str


class ExtractAudioRequest(BaseModel):
    url: str
    start_sec: float | None = None
    end_sec: float | None = None


class VideoInfoResponse(BaseModel):
    title: str
    duration: int
    channel: str


@router.post("/info", response_model=VideoInfoResponse)
async def fetch_video_info(req: YouTubeURLRequest):
    try:
        info = await get_video_info(req.url)
        return info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/extract-audio")
async def extract_video_audio(req: ExtractAudioRequest, bg: BackgroundTasks):
    try:
        audio_path = await extract_audio(req.url, req.start_sec, req.end_sec)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch title for the header
    try:
        info = await get_video_info(req.url)
        title = info["title"]
        duration = info["duration"]
    except Exception:
        title = "Unknown"
        duration = 0

    bg.add_task(cleanup_temp_file, audio_path)

    return FileResponse(
        path=str(audio_path),
        media_type="audio/wav",
        filename="youtube_audio.wav",
        headers={
            "X-Video-Title": quote(title),
            "X-Video-Duration": str(duration),
        },
    )
