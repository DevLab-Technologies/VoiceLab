"""
TTS router — handles speech generation requests.

The endpoint resolves which TTS engine to use from the profile's ``model``
field, delegates to the ModelManager to obtain (and if needed load) the
correct engine, then writes the generation record to the profile store.
"""

import asyncio
import logging
import shutil
import threading
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import List

from app.models import GenerateRequest, GenerationResponse
from app.services.model_manager import model_manager
from app.services.profile_store import profile_store
from app.config import GENERATIONS_DIR

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tts"])

# Module-level cancellation flag.
# Single-user desktop app — only one generation runs at a time.
_cancelled = threading.Event()


@router.post("/tts/generate", response_model=GenerationResponse)
async def generate_speech(request: GenerateRequest):
    """
    Generate speech from text.

    Two modes are supported:

    Flow A — Voice cloning (profile-based):
        ``profile_id`` is provided.  The profile supplies reference audio,
        transcript, and model choice.

    Flow B — Profileless generation (no profile):
        ``profile_id`` is None.  ``model`` must be one of
        ``"qwen3-tts-voice-design"`` or ``"qwen3-tts-custom-voice"``.
        Voice design requires ``instruct``; custom voice requires ``speaker``.
    """
    _cancelled.clear()

    # ------------------------------------------------------------------ #
    # Flow B — Profileless generation (voice design or custom voice)
    # ------------------------------------------------------------------ #
    if request.profile_id is None:
        model_id = request.model  # validated non-None by GenerateRequest

        if model_id not in ("qwen3-tts-voice-design", "qwen3-tts-custom-voice"):
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model_id}' requires a voice profile",
            )

        try:
            engine = model_manager.get_engine_for_model(model_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        await _wait_for_engine(engine, model_id)

        language = request.language or "English"

        if model_id == "qwen3-tts-voice-design":
            instruct = request.instruct  # non-empty guaranteed by validator
            logger.info(
                "Generating speech (voice design): model=%s language=%s "
                "instruct_len=%d text_len=%d",
                model_id,
                language,
                len(instruct),
                len(request.text),
            )
            gen_start_time = time.time()
            try:
                result = await asyncio.to_thread(
                    engine.generate,
                    gen_text=request.text,
                    instruct=instruct,
                    language=language,
                )
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc))
            except Exception as exc:
                logger.error("Voice design generation failed: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail="TTS generation failed unexpectedly. Check server logs for details.",
                )
        else:  # qwen3-tts-custom-voice
            logger.info(
                "Generating speech (custom voice): model=%s language=%s "
                "speaker=%s instruct_len=%d text_len=%d",
                model_id,
                language,
                request.speaker,
                len(request.instruct) if request.instruct else 0,
                len(request.text),
            )
            gen_start_time = time.time()
            generate_kwargs = {
                "gen_text": request.text,
                "speaker": request.speaker,
                "language": language,
            }
            if request.instruct:
                generate_kwargs["instruct"] = request.instruct
            try:
                result = await asyncio.to_thread(engine.generate, **generate_kwargs)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc))
            except Exception as exc:
                logger.error("Custom voice generation failed: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail="TTS generation failed unexpectedly. Check server logs for details.",
                )

        if _cancelled.is_set():
            try:
                gen_dir = Path(result["audio_path"]).parent
                if gen_dir.exists():
                    shutil.rmtree(gen_dir)
            except Exception:
                pass
            raise HTTPException(status_code=409, detail="Generation cancelled")

        gen_elapsed = time.time() - gen_start_time

        generation = profile_store.add_generation(
            profile_id=None,
            profile_name=None,
            text=request.text,
            dialect=None,
            audio_path=result["audio_path"],
            duration=result["duration"],
            model=model_id,
            language=language,
            elapsed_seconds=gen_elapsed,
            instruct=request.instruct,
            speaker=request.speaker,
        )
        return generation

    # ------------------------------------------------------------------ #
    # Flow A — Voice cloning (profile-based, existing behaviour)
    # ------------------------------------------------------------------ #
    profile = profile_store.get(request.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Resolve model from profile (default to habibi-tts for backward compat)
    model_id = profile.get("model", "habibi-tts")

    # Attempt to obtain the engine; ModelManager handles load/unload lifecycle
    try:
        engine = model_manager.get_engine_for_model(model_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    await _wait_for_engine(engine, model_id)

    # Build engine-specific kwargs
    if model_id == "habibi-tts":
        dialect = request.dialect or profile.get("dialect", "MSA")
        language = None
        generate_kwargs: dict = {"dialect": dialect}
        # Pass tuning parameters if provided
        if request.speed is not None:
            generate_kwargs["speed"] = request.speed
        if request.nfe_step is not None:
            generate_kwargs["nfe_step"] = request.nfe_step
        if request.cfg_strength is not None:
            generate_kwargs["cfg_strength"] = request.cfg_strength
    elif model_id == "qwen3-tts":
        dialect = None
        language = request.language or profile.get("language") or "English"
        generate_kwargs = {"language": language}
    else:
        dialect = profile.get("dialect")
        language = profile.get("language")
        generate_kwargs = {}

    logger.info(
        "Generating speech: profile=%s model=%s kwargs=%s text_len=%d",
        request.profile_id,
        model_id,
        generate_kwargs,
        len(request.text),
    )

    gen_start_time = time.time()
    try:
        result = await asyncio.to_thread(
            engine.generate,
            ref_audio_path=profile["ref_audio_path"],
            ref_text=profile["ref_text"],
            gen_text=request.text,
            **generate_kwargs,
        )
    except ValueError as exc:
        # Validation errors (e.g. reference audio too short) are client errors
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        error_msg = str(exc)
        # Provide a friendlier message for tensor size mismatch errors
        if "Sizes of tensors must match" in error_msg:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Text is too long for the reference audio. "
                    "Try shorter text or use a longer reference audio clip."
                ),
            )
        logger.error("TTS generation failed (RuntimeError): %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="TTS generation failed unexpectedly. Check server logs for details.")
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="TTS generation failed unexpectedly. Check server logs for details.")

    # Check if generation was cancelled while inference was running
    if _cancelled.is_set():
        # Clean up the generated audio file
        try:
            gen_dir = Path(result["audio_path"]).parent
            if gen_dir.exists():
                shutil.rmtree(gen_dir)
        except Exception:
            pass
        raise HTTPException(status_code=409, detail="Generation cancelled")

    gen_elapsed = time.time() - gen_start_time

    generation = profile_store.add_generation(
        profile_id=request.profile_id,
        profile_name=profile["name"],
        text=request.text,
        dialect=dialect,
        audio_path=result["audio_path"],
        duration=result["duration"],
        model=model_id,
        language=language if model_id == "qwen3-tts" else None,
        elapsed_seconds=gen_elapsed,
    )

    return generation


async def _wait_for_engine(engine, model_id: str) -> None:
    """
    Poll until *engine* is loaded.

    Raises HTTPException (503) if the engine fails to load or is not
    installed, or if it does not become ready within the time limit.
    """
    if engine.is_loaded:
        return

    max_wait_seconds = 300  # 5-minute upper bound
    poll_interval = 1.0
    waited = 0.0
    while not engine.is_loaded and waited < max_wait_seconds:
        await asyncio.sleep(poll_interval)
        waited += poll_interval
        status = engine.loading_status
        if status.startswith("error"):
            raise HTTPException(
                status_code=503,
                detail="Engine failed to load. Check server logs for details.",
            )
        if status == "not_installed":
            raise HTTPException(
                status_code=503,
                detail=(
                    f"The '{model_id}' package is not installed on this server. "
                    "Contact your administrator."
                ),
            )

    if not engine.is_loaded:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{model_id}' did not finish loading in time.",
        )


@router.post("/tts/cancel")
async def cancel_generation():
    """
    Signal that the current generation should be cancelled.

    The actual model inference cannot be interrupted mid-computation, but
    once it finishes, the result will be discarded and the generated audio
    file cleaned up.
    """
    _cancelled.set()
    logger.info("Generation cancellation requested")
    return {"status": "cancelling"}


@router.get("/tts/generations", response_model=List[GenerationResponse])
async def list_generations():
    return profile_store.list_generations()


@router.get("/tts/generations/{generation_id}", response_model=GenerationResponse)
async def get_generation(generation_id: str):
    gen = profile_store.get_generation(generation_id)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.delete("/tts/generations/{generation_id}")
async def delete_generation(generation_id: str):
    success = profile_store.delete_generation(generation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Generation not found")
    return {"status": "deleted"}
