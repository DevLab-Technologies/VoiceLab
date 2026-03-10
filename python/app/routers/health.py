"""
Health router — reports server liveness and model state.

The response is kept backward-compatible: the legacy ``model_loaded`` boolean
is still present (True if ANY model is currently loaded in memory) so existing
clients continue to work without changes.  A new ``models`` list provides
per-model detail for updated clients.
"""

from fastapi import APIRouter

from app.services.model_manager import model_manager

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    Return server health and current state of all registered TTS models.

    Response fields
    ---------------
    status       — always "ok" when the server is running
    model_loaded — True if at least one model is loaded (backward compat)
    version      — application version string
    models       — list of per-model status dicts (new in v1.1.0)
    """
    models_status = model_manager.list_models()
    any_loaded = model_manager.any_model_loaded()

    return {
        "status": "ok",
        # Backward-compatible field: True when any engine is ready
        "model_loaded": any_loaded,
        "version": "1.1.0",
        "models": models_status,
    }
