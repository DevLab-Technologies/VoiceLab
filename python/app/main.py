from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, profiles, tts, audio, stt, youtube
from app.routers import models as models_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Models are loaded on-demand by the ModelManager when a generation request
    # arrives.  No model is pre-loaded at startup so the server starts quickly.
    yield


app = FastAPI(title="VoiceLab Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Video-Title", "X-Video-Duration"],
)

app.include_router(health.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(tts.router, prefix="/api")
app.include_router(audio.router, prefix="/api")
app.include_router(models_router.router, prefix="/api")
app.include_router(youtube.router, prefix="/api")
app.include_router(stt.router, prefix="/api")
