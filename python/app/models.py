from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime
from enum import Enum


class DialectCode(str, Enum):
    MSA = "MSA"
    SAU = "SAU"
    UAE = "UAE"
    ALG = "ALG"
    IRQ = "IRQ"
    EGY = "EGY"
    MAR = "MAR"
    OMN = "OMN"
    TUN = "TUN"
    LEV = "LEV"
    SDN = "SDN"
    LBY = "LBY"


class ProfileResponse(BaseModel):
    id: str
    name: str
    dialect: Optional[DialectCode] = None
    ref_text: str
    ref_audio_path: str
    ref_audio_duration: float
    created_at: str
    updated_at: str
    model: str = "habibi-tts"
    language: Optional[str] = None


class ProfileCreate(BaseModel):
    """
    Schema for the multipart form submitted when creating a new profile.

    ``dialect`` is required for HabibiTTS profiles.
    ``model`` selects the TTS backend; defaults to "habibi-tts".
    ``language`` is used by qwen3-tts for multilingual synthesis.
    """
    name: str
    dialect: Optional[DialectCode] = None
    ref_text: str
    model: str = Field(default="habibi-tts", description="TTS model identifier")
    language: Optional[str] = Field(
        default=None,
        description="Target language for qwen3-tts (e.g. 'English', 'Arabic')",
    )


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dialect: Optional[DialectCode] = None
    ref_text: Optional[str] = None
    model: Optional[str] = Field(
        default=None,
        description="TTS model identifier",
    )
    language: Optional[str] = Field(
        default=None,
        description="Target language for qwen3-tts",
    )


class GenerateRequest(BaseModel):
    profile_id: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=5000)
    dialect: Optional[DialectCode] = None
    # Optional per-request language override (respected by qwen3-tts)
    language: Optional[str] = None
    # Voice design mode: model + instruct replace profile_id
    model: Optional[str] = Field(
        default=None,
        description="TTS model for voice design mode (e.g. 'qwen3-tts-voice-design')",
    )
    instruct: Optional[str] = Field(
        default=None,
        description="Natural-language voice description for voice design mode",
    )
    speaker: Optional[str] = Field(
        default=None,
        description="Preset speaker name for custom voice mode (e.g. 'Vivian', 'Dylan')",
    )
    # HabibiTTS tuning parameters
    speed: Optional[float] = Field(default=None, ge=0.5, le=2.0, description="Speed multiplier (0.5-2.0)")
    nfe_step: Optional[int] = Field(default=None, ge=8, le=64, description="Quality steps (8-64, higher=better)")
    cfg_strength: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Text adherence (0-5)")

    @model_validator(mode="after")
    def _check_mode(self) -> "GenerateRequest":
        if self.profile_id is None:
            if not self.model:
                raise ValueError("Either 'profile_id' or 'model' must be provided")
            if self.model == "qwen3-tts-voice-design":
                if not self.instruct or not self.instruct.strip():
                    raise ValueError("'instruct' is required for voice design mode")
            elif self.model == "qwen3-tts-custom-voice":
                if not self.speaker or not self.speaker.strip():
                    raise ValueError("'speaker' is required for custom voice mode")
            else:
                raise ValueError(f"Model '{self.model}' is not supported without a profile")
        return self


class GenerationResponse(BaseModel):
    id: str
    profile_id: Optional[str] = None
    profile_name: Optional[str] = None
    text: str
    dialect: Optional[DialectCode] = None
    audio_path: str
    duration: float
    elapsed_seconds: float = 0.0
    created_at: str
    model: str = "habibi-tts"
    language: Optional[str] = None
    instruct: Optional[str] = None
    speaker: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str
    models: Optional[list] = None
