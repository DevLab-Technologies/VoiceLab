from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional

from app.models import ProfileResponse, ProfileUpdate, DialectCode
from app.services.profile_store import profile_store

router = APIRouter(tags=["profiles"])


@router.get("/profiles", response_model=List[ProfileResponse])
async def list_profiles():
    return profile_store.list_all()


@router.get("/profiles/{profile_id}", response_model=ProfileResponse)
async def get_profile(profile_id: str):
    profile = profile_store.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profiles", response_model=ProfileResponse)
async def create_profile(
    name: str = Form(...),
    dialect: Optional[DialectCode] = Form(default=None),
    ref_text: str = Form(...),
    ref_audio: UploadFile = File(...),
    model: str = Form(default="habibi-tts"),
    language: Optional[str] = Form(default=None),
):
    audio_data = await ref_audio.read()
    filename = ref_audio.filename or "recording.webm"
    profile = await profile_store.create(
        name=name,
        dialect=dialect,
        ref_text=ref_text,
        audio_data=audio_data,
        audio_filename=filename,
        model=model,
        language=language,
    )
    return profile


@router.put("/profiles/{profile_id}", response_model=ProfileResponse)
async def update_profile(profile_id: str, update: ProfileUpdate):
    profile = profile_store.update(profile_id, update)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    success = profile_store.delete(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "deleted"}
