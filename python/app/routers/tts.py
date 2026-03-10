"""
TTS router — handles speech generation requests.

The endpoint resolves which TTS engine to use from the profile's ``model``
field, delegates to the ModelManager to obtain (and if needed load) the
correct engine, then writes the generation record to the profile store.
"""

import asyncio
import logging
from fastapi import APIRouter, HTTPException
from typing import List

from app.models import GenerateRequest, GenerationResponse
from app.services.model_manager import model_manager
from app.services.profile_store import profile_store

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tts"])


@router.post("/tts/generate", response_model=GenerationResponse)
async def generate_speech(request: GenerateRequest):
    """
    Generate speech from text using the TTS model associated with the profile.

    Flow
    ----
    1. Look up the profile to obtain its ``model`` (and optional ``language``).
    2. Ask the ModelManager for the engine, which will unload any other active
       engine and begin loading the requested one if it isn't already loaded.
    3. Wait until the engine is ready (polling in a background thread).
    4. Run inference and persist the generation record.
    """
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

    # Block until the engine is ready (it may still be loading)
    if not engine.is_loaded:
        max_wait_seconds = 300  # 5-minute upper bound
        poll_interval = 1.0
        waited = 0.0
        while not engine.is_loaded and waited < max_wait_seconds:
            await asyncio.sleep(poll_interval)
            waited += poll_interval
            status = engine.loading_status
            if status.startswith("error:"):
                raise HTTPException(
                    status_code=503,
                    detail=f"Engine failed to load: {status}",
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

    # Build engine-specific kwargs
    dialect = request.dialect or profile.get("dialect", "MSA")
    language = request.language or profile.get("language") or "English"

    if model_id == "habibi-tts":
        generate_kwargs = {"dialect": dialect}
    elif model_id == "qwen3-tts":
        generate_kwargs = {"language": language}
    else:
        generate_kwargs = {}

    logger.info(
        "Generating speech: profile=%s model=%s kwargs=%s text_len=%d",
        request.profile_id,
        model_id,
        generate_kwargs,
        len(request.text),
    )

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
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {exc}")

    generation = profile_store.add_generation(
        profile_id=request.profile_id,
        profile_name=profile["name"],
        text=request.text,
        dialect=dialect,
        audio_path=result["audio_path"],
        duration=result["duration"],
        model=model_id,
        language=language if model_id == "qwen3-tts" else None,
    )

    return generation


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
