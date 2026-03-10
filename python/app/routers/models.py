"""
Models router — exposes the model registry over HTTP.

Endpoints
---------
GET    /api/models                    — list all models with download/load status
POST   /api/models/{model_id}/download — start a background download
DELETE /api/models/{model_id}         — unload model and reset download state
GET    /api/models/{model_id}/status  — fetch status for a single model
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.services.model_manager import model_manager, MODELS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["models"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ModelStatusResponse(BaseModel):
    id: str
    name: str
    description: str
    languages: List[str]
    size_mb: int
    pip_package: str
    download_status: str        # not_downloaded | downloading | downloaded | error
    download_progress: int      # 0-100
    download_error: Optional[str]
    loaded: bool
    engine_status: str          # idle | loading | ready | error: … | not_installed


class DownloadStartResponse(BaseModel):
    model_id: str
    message: str


class DeleteModelResponse(BaseModel):
    model_id: str
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/models", response_model=List[ModelStatusResponse])
async def list_models():
    """Return all registered models with their current download and load state."""
    return model_manager.list_models()


@router.get("/models/{model_id}/status", response_model=ModelStatusResponse)
async def get_model_status(model_id: str):
    """Return the status of a single model."""
    status = model_manager.get_model_status(model_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown model: '{model_id}'. "
                   f"Valid models are: {list(MODELS.keys())}",
        )
    return status


@router.post("/models/{model_id}/download", response_model=DownloadStartResponse)
async def start_model_download(model_id: str):
    """
    Initiate a background download for *model_id*.

    Returns immediately with a 202-style success message.  Poll
    GET /api/models/{model_id}/status to track progress.
    """
    if model_id not in MODELS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown model: '{model_id}'. "
                   f"Valid models are: {list(MODELS.keys())}",
        )

    started = model_manager.start_download(model_id)
    if started:
        logger.info("Download initiated for model: %s", model_id)
        return DownloadStartResponse(
            model_id=model_id,
            message=f"Download started for '{model_id}'. "
                    "Poll GET /api/models/{model_id}/status for progress.",
        )

    # Already downloading or downloaded — return current status as context
    status = model_manager.get_model_status(model_id)
    dl_status = status["download_status"] if status else "unknown"

    if dl_status == "downloaded":
        return DownloadStartResponse(
            model_id=model_id,
            message=f"Model '{model_id}' is already downloaded.",
        )

    if dl_status == "downloading":
        return DownloadStartResponse(
            model_id=model_id,
            message=f"Model '{model_id}' is already being downloaded.",
        )

    raise HTTPException(
        status_code=409,
        detail=f"Cannot start download for '{model_id}' (current status: {dl_status}).",
    )


@router.delete("/models/{model_id}", response_model=DeleteModelResponse)
async def delete_model(model_id: str):
    """
    Unload model from memory and reset its download state.

    Note: this does not purge HuggingFace Hub cache files from disk because
    the cache directory is managed by the hub library.
    """
    if model_id not in MODELS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown model: '{model_id}'. "
                   f"Valid models are: {list(MODELS.keys())}",
        )

    success = model_manager.delete_model(model_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_id}' not found.",
        )

    logger.info("Model deleted/unloaded: %s", model_id)
    return DeleteModelResponse(
        model_id=model_id,
        message=f"Model '{model_id}' has been unloaded and reset to not_downloaded.",
    )
