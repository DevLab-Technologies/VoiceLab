import asyncio
import logging
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from app.config import YOUTUBE_TEMP_DIR, MAX_YOUTUBE_DURATION_SEC, SAMPLE_RATE

logger = logging.getLogger(__name__)

YOUTUBE_URL_PATTERN = re.compile(
    r"^(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)[\w\-]{11}([&?].*)?$"
)


def _validate_url(url: str) -> None:
    if not YOUTUBE_URL_PATTERN.match(url):
        raise ValueError("Invalid YouTube URL")


def _run_yt_dlp(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "yt_dlp", *args],
        capture_output=True,
        text=True,
        timeout=120,
    )


async def get_video_info(url: str) -> dict:
    """Fetch video metadata without downloading."""
    _validate_url(url)
    result = await asyncio.to_thread(
        _run_yt_dlp,
        [
            "--no-download",
            "--no-call-home",
            "--print", "%(title)s\n%(duration)s\n%(channel)s",
            "--no-playlist",
            "--", url,
        ],
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        if "Private video" in stderr or "Sign in" in stderr:
            raise ValueError("Video is private or requires authentication")
        logger.warning("yt-dlp failed: %s", stderr[:300])
        raise ValueError("Failed to fetch video info")

    lines = result.stdout.strip().split("\n")
    if len(lines) < 3:
        raise ValueError("Unexpected yt-dlp output format")

    title = lines[0]
    try:
        duration = int(float(lines[1]))
    except (ValueError, IndexError):
        duration = 0
    channel = lines[2]

    if duration > MAX_YOUTUBE_DURATION_SEC:
        raise ValueError(
            f"Video is too long ({duration}s). Maximum allowed is {MAX_YOUTUBE_DURATION_SEC}s"
        )

    return {"title": title, "duration": duration, "channel": channel}


async def extract_audio(
    url: str,
    start_sec: float | None = None,
    end_sec: float | None = None,
) -> Path:
    """Download video audio and convert to 24kHz mono WAV."""
    _validate_url(url)
    YOUTUBE_TEMP_DIR.mkdir(parents=True, exist_ok=True)

    temp_dir = Path(tempfile.mkdtemp(dir=YOUTUBE_TEMP_DIR))
    raw_path = temp_dir / "raw_audio"
    output_path = temp_dir / "audio.wav"

    try:
        # Download best audio
        dl_args = [
            "-x",
            "--audio-format", "wav",
            "--no-call-home",
            "--no-playlist",
            "-o", str(raw_path),
            "--", url,
        ]
        result = await asyncio.to_thread(_run_yt_dlp, dl_args)
        if result.returncode != 0:
            logger.warning("yt-dlp download failed: %s", result.stderr.strip()[:300])
            raise ValueError("Audio download failed")

        # Find the downloaded file (yt-dlp may add extension)
        downloaded = None
        for f in temp_dir.iterdir():
            if f.name.startswith("raw_audio"):
                downloaded = f
                break
        if not downloaded or not downloaded.exists():
            raise ValueError("Downloaded audio file not found")

        # Convert to 24kHz mono WAV with optional trimming.
        # Place -ss before -i for fast keyframe seeking, then use
        # -ss 0 after -i for sample-accurate trim from that point.
        ffmpeg_args = ["ffmpeg", "-y"]
        if start_sec is not None:
            ffmpeg_args.extend(["-ss", str(start_sec)])
        ffmpeg_args.extend(["-i", str(downloaded)])
        if end_sec is not None:
            duration = (end_sec - start_sec) if start_sec is not None else end_sec
            ffmpeg_args.extend(["-t", str(duration)])
        ffmpeg_args.extend([
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            "-acodec", "pcm_s16le",
            str(output_path),
        ])

        ffmpeg_result = await asyncio.to_thread(
            subprocess.run, ffmpeg_args, capture_output=True, text=True, timeout=120
        )
        if ffmpeg_result.returncode != 0:
            logger.warning("ffmpeg failed: %s", ffmpeg_result.stderr[:300])
            raise ValueError("Audio conversion failed")

        # Clean up raw file
        if downloaded != output_path and downloaded.exists():
            downloaded.unlink()

        return output_path

    except Exception:
        # Clean up on error
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise


def cleanup_temp_file(path: Path) -> None:
    """Remove a temp file and its parent directory."""
    try:
        if path.exists():
            parent = path.parent
            path.unlink()
            if parent != YOUTUBE_TEMP_DIR and not any(parent.iterdir()):
                parent.rmdir()
    except Exception as e:
        logger.warning("Failed to clean up temp file %s: %s", path, e)
