import type { DialectInfo } from '../types/dialect'
import type { ModelId } from '../types/model'

// Arabic dialects for HabibiTTS
export const DIALECTS: DialectInfo[] = [
  { code: 'MSA', nameAr: 'العربية الفصحى', nameEn: 'Modern Standard Arabic' },
  { code: 'EGY', nameAr: 'المصرية', nameEn: 'Egyptian' },
  { code: 'SAU', nameAr: 'السعودية', nameEn: 'Saudi' },
  { code: 'UAE', nameAr: 'الإماراتية', nameEn: 'Emirati' },
  { code: 'LEV', nameAr: 'الشامية', nameEn: 'Levantine' },
  { code: 'IRQ', nameAr: 'العراقية', nameEn: 'Iraqi' },
  { code: 'MAR', nameAr: 'المغربية', nameEn: 'Moroccan' },
  { code: 'ALG', nameAr: 'الجزائرية', nameEn: 'Algerian' },
  { code: 'TUN', nameAr: 'التونسية', nameEn: 'Tunisian' },
  { code: 'LBY', nameAr: 'الليبية', nameEn: 'Libyan' },
  { code: 'SDN', nameAr: 'السودانية', nameEn: 'Sudanese' },
  { code: 'OMN', nameAr: 'العمانية', nameEn: 'Omani' }
]

export const DIALECT_MAP = Object.fromEntries(DIALECTS.map((d) => [d.code, d]))

// Languages for Qwen3-TTS
export interface LanguageInfo {
  code: string
  name: string
  nativeName: string
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'English', name: 'English', nativeName: 'English' },
  { code: 'Chinese', name: 'Chinese', nativeName: '中文' },
  { code: 'Japanese', name: 'Japanese', nativeName: '日本語' },
  { code: 'Korean', name: 'Korean', nativeName: '한국어' },
  { code: 'German', name: 'German', nativeName: 'Deutsch' },
  { code: 'French', name: 'French', nativeName: 'Français' },
  { code: 'Russian', name: 'Russian', nativeName: 'Русский' },
  { code: 'Portuguese', name: 'Portuguese', nativeName: 'Português' },
  { code: 'Spanish', name: 'Spanish', nativeName: 'Español' },
  { code: 'Italian', name: 'Italian', nativeName: 'Italiano' }
]

export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))

// Preset speakers for Qwen3-TTS CustomVoice
export interface SpeakerInfo {
  id: string
  name: string
  description: string
}

export const SPEAKERS: SpeakerInfo[] = [
  { id: 'Vivian', name: 'Vivian', description: 'Female, warm and expressive' },
  { id: 'Serena', name: 'Serena', description: 'Female, calm and gentle' },
  { id: 'Uncle_Fu', name: 'Uncle Fu', description: 'Male, mature and deep' },
  { id: 'Dylan', name: 'Dylan', description: 'Male, young and energetic' },
  { id: 'Eric', name: 'Eric', description: 'Male, professional and clear' },
  { id: 'Ryan', name: 'Ryan', description: 'Male, natural and friendly' },
  { id: 'Aiden', name: 'Aiden', description: 'Male, warm and conversational' },
  { id: 'Ono_Anna', name: 'Ono Anna', description: 'Female, soft and melodic' },
  { id: 'Sohee', name: 'Sohee', description: 'Female, bright and lively' },
]

// Model info
export interface ModelInfoStatic {
  id: ModelId
  name: string
  description: string
  languages: string[]
  sizeMB: number
}

export const MODEL_INFO: Record<ModelId, ModelInfoStatic> = {
  'habibi-tts': {
    id: 'habibi-tts',
    name: 'HabibiTTS',
    description: 'Arabic dialect TTS with 12 dialect support and zero-shot voice cloning',
    languages: ['Arabic (12 dialects)'],
    sizeMB: 800
  },
  'qwen3-tts': {
    id: 'qwen3-tts',
    name: 'Qwen3-TTS 1.7B',
    description: 'Multilingual TTS with voice cloning for 10 languages',
    languages: ['English', 'Chinese', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'],
    sizeMB: 3400
  },
  'qwen3-tts-voice-design': {
    id: 'qwen3-tts-voice-design',
    name: 'Qwen3-TTS VoiceDesign',
    description: 'Multilingual TTS — describe a voice instead of cloning',
    languages: ['English', 'Chinese', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'],
    sizeMB: 3400
  },
  'qwen3-tts-custom-voice': {
    id: 'qwen3-tts-custom-voice',
    name: 'Qwen3-TTS CustomVoice',
    description: 'Multilingual TTS with 9 preset voices and style control',
    languages: ['English', 'Chinese', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'],
    sizeMB: 3400
  }
}
