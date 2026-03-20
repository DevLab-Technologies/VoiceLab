import { create } from 'zustand'
import axios from 'axios'
import type { Profile } from '../types/profile'
import type { Generation } from '../types/tts'
import type { DialectCode } from '../types/dialect'
import type { ModelId, ModelInfo } from '../types/model'
import * as profilesApi from '../api/profiles'
import * as ttsApi from '../api/tts'
import * as audioApi from '../api/audio'
import * as modelsApi from '../api/models'
import * as sttApi from '../api/stt'
import type { STTModelInfo, Transcription } from '../api/stt'
import type { VideoInfo } from '../api/youtube'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'

interface AppState {
  // Backend
  backendReady: boolean
  modelLoaded: boolean
  modelStatus: string
  initialDataLoaded: boolean
  backendStage: string
  backendMessage: string
  setBackendReady: (ready: boolean) => void
  setModelLoaded: (loaded: boolean) => void
  setBackendStage: (stage: string, message: string) => void
  pollHealth: () => Promise<void>

  // Models
  availableModels: ModelInfo[]
  fetchModels: () => Promise<void>
  downloadModel: (modelId: ModelId) => Promise<void>
  deleteModel: (modelId: ModelId) => Promise<void>

  // Profiles
  profiles: Profile[]
  profilesLoading: boolean
  selectedProfileId: string | null
  fetchProfiles: () => Promise<void>
  setSelectedProfileId: (id: string | null) => void
  createProfile: (
    name: string,
    model: ModelId,
    dialect: DialectCode | undefined,
    language: string | undefined,
    refText: string,
    audio: Blob,
    filename: string
  ) => Promise<Profile>
  deleteProfile: (id: string) => Promise<void>

  // TTS
  generationText: string
  isGenerating: boolean
  currentGeneration: Generation | null
  generations: Generation[]
  setGenerationText: (text: string) => void
  generate: () => Promise<void>
  stopGeneration: () => void
  fetchGenerations: () => Promise<void>
  deleteGeneration: (id: string) => Promise<void>
  prepareRegeneration: (generation: Generation) => void

  // Voice Design mode
  generationMode: 'clone' | 'design' | 'preset'
  setGenerationMode: (mode: 'clone' | 'design' | 'preset') => void
  voiceDesignInstruct: string
  setVoiceDesignInstruct: (instruct: string) => void
  voiceDesignLanguage: string
  setVoiceDesignLanguage: (language: string) => void

  // Custom Voice mode
  customVoiceSpeaker: string
  setCustomVoiceSpeaker: (speaker: string) => void
  customVoiceLanguage: string
  setCustomVoiceLanguage: (language: string) => void
  customVoiceInstruct: string
  setCustomVoiceInstruct: (instruct: string) => void

  // Generation Parameters (HabibiTTS)
  genSpeed: number
  genNfeStep: number
  genCfgStrength: number
  setGenSpeed: (v: number) => void
  setGenNfeStep: (v: number) => void
  setGenCfgStrength: (v: number) => void

  // UI
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  dismissToast: (id: string) => void

  // STT
  sttModel: string
  setSttModel: (model: string) => void
  sttModels: STTModelInfo[]
  fetchSttModels: () => Promise<void>
  downloadSttModel: (modelId: string) => Promise<void>
  deleteSttModel: (modelId: string) => Promise<void>

  // STT Transcription State (persistent across navigation)
  sttTranscribing: boolean
  sttResult: string
  sttAudioBlob: Blob | null
  sttAudioSource: 'record' | 'import' | 'youtube'
  setSttAudioBlob: (blob: Blob | null, source: 'record' | 'import' | 'youtube') => void
  setSttAudioSource: (source: 'record' | 'import' | 'youtube') => void
  setSttResult: (text: string) => void
  transcribe: () => Promise<void>
  stopTranscription: () => void
  clearSttSession: () => void

  // YouTube importer state (persistent across navigation)
  ytUrl: string
  ytState: 'idle' | 'loading-info' | 'preview' | 'extracting' | 'done' | 'error'
  ytInfo: VideoInfo | null
  ytError: string
  setYtUrl: (url: string) => void
  setYtState: (state: 'idle' | 'loading-info' | 'preview' | 'extracting' | 'done' | 'error') => void
  setYtInfo: (info: VideoInfo | null) => void
  setYtError: (error: string) => void
  resetYtState: () => void

  // Transcription History
  transcriptions: Transcription[]
  fetchTranscriptions: () => Promise<void>
  deleteTranscription: (id: string) => Promise<void>

  // App version & updates
  appVersion: string
  updateStatus: UpdateStatus
  updateVersion: string
  updateProgress: number
  updateError: string
  initUpdateListener: () => () => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void

  // Developer
  devMode: boolean
  setDevMode: (enabled: boolean) => void
}

// Module-level AbortControllers for cancelling in-flight requests
let _generationAbort: AbortController | null = null
let _sttAbort: AbortController | null = null
let _updateResetTimer: ReturnType<typeof setTimeout> | null = null

export const useAppStore = create<AppState>((set, get) => ({
  // Backend
  backendReady: false,
  modelLoaded: false,
  modelStatus: 'idle',
  initialDataLoaded: false,
  backendStage: 'connecting',
  backendMessage: 'Starting...',
  setBackendReady: (ready) => set({ backendReady: ready }),
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),
  setBackendStage: (stage, message) => set({ backendStage: stage, backendMessage: message }),
  pollHealth: async () => {
    try {
      const health = await audioApi.checkHealth()
      const wasReady = get().backendReady
      set({
        backendReady: true,
        modelLoaded: health.model_loaded,
        modelStatus: health.model_status || 'idle'
      })

      // On first successful connection, load initial data
      if (!wasReady || !get().initialDataLoaded) {
        set({ initialDataLoaded: true })
        // Silently load profiles, generations, and model status
        try {
          const profiles = await profilesApi.fetchProfiles()
          set({ profiles })
        } catch {
          // silent — will retry on next page visit
        }
        try {
          const generations = await ttsApi.fetchGenerations()
          set({ generations })
        } catch {
          // silent
        }
        try {
          const transcriptions = await sttApi.fetchTranscriptions()
          set({ transcriptions })
        } catch {
          // silent
        }
        try {
          const models = await modelsApi.fetchModels()
          set({
            availableModels: models.map((m) => ({
              id: m.id as ModelId,
              name: m.name,
              description: m.description,
              languages: m.languages,
              size_mb: m.size_mb,
              status: m.download_status === 'downloaded'
                ? (m.loaded ? 'loaded' : 'downloaded')
                : m.download_status === 'downloading'
                  ? 'downloading'
                  : m.download_status === 'error'
                    ? 'error'
                    : 'not_downloaded',
              download_progress: m.download_progress,
              error: m.download_error ?? undefined
            }))
          })
        } catch {
          // silent
        }
      }
    } catch {
      set({ backendReady: false, modelLoaded: false, modelStatus: 'connecting' })
    }
  },

  // Models
  availableModels: [],
  fetchModels: async () => {
    if (!get().backendReady) return
    try {
      const models = await modelsApi.fetchModels()
      set({
        availableModels: models.map((m: any) => ({
          id: m.id as ModelId,
          name: m.name,
          description: m.description,
          languages: m.languages,
          size_mb: m.size_mb,
          status: m.download_status === 'downloaded'
            ? (m.loaded ? 'loaded' : 'downloaded')
            : m.download_status === 'downloading'
              ? 'downloading'
              : m.download_status === 'error'
                ? 'error'
                : 'not_downloaded',
          download_progress: m.download_progress,
          error: m.download_error ?? undefined
        }))
      })
    } catch {
      // silent
    }
  },
  downloadModel: async (modelId) => {
    try {
      await modelsApi.downloadModel(modelId)
      get().addToast(`Downloading ${modelId}...`, 'info')
      // Start polling for progress
      const pollInterval = setInterval(async () => {
        try {
          const status = await modelsApi.getModelStatus(modelId)
          const models = get().availableModels.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  status: status.download_status === 'downloaded'
                    ? ('downloaded' as const)
                    : status.download_status === 'downloading'
                      ? ('downloading' as const)
                      : status.download_status === 'error'
                        ? ('error' as const)
                        : ('not_downloaded' as const),
                  download_progress: status.download_progress,
                  error: status.download_error ?? undefined
                }
              : m
          )
          set({ availableModels: models })

          if (status.download_status === 'downloaded') {
            clearInterval(pollInterval)
            get().addToast(`${modelId} downloaded successfully`, 'success')
          } else if (status.download_status === 'error') {
            clearInterval(pollInterval)
            get().addToast(`Failed to download ${modelId}`, 'error')
          }
        } catch {
          clearInterval(pollInterval)
        }
      }, 2000)
    } catch (err: any) {
      get().addToast(err?.response?.data?.detail || 'Download failed', 'error')
    }
  },
  deleteModel: async (modelId) => {
    try {
      await modelsApi.deleteModel(modelId)
      set({
        availableModels: get().availableModels.map((m) =>
          m.id === modelId
            ? { ...m, status: 'not_downloaded' as const, download_progress: 0 }
            : m
        )
      })
      get().addToast(`${modelId} removed`, 'success')
    } catch (err: any) {
      get().addToast(err?.response?.data?.detail || 'Failed to remove model', 'error')
    }
  },

  // Profiles
  profiles: [],
  profilesLoading: false,
  selectedProfileId: null,
  fetchProfiles: async () => {
    if (!get().backendReady) return
    set({ profilesLoading: true })
    try {
      const profiles = await profilesApi.fetchProfiles()
      set({ profiles, profilesLoading: false })
    } catch {
      set({ profilesLoading: false })
      get().addToast('Failed to load profiles', 'error')
    }
  },
  setSelectedProfileId: (id) => set({ selectedProfileId: id }),
  createProfile: async (name, model, dialect, language, refText, audio, filename) => {
    const profile = await profilesApi.createProfile(name, model, dialect, language, refText, audio, filename)
    set((state) => ({ profiles: [profile, ...state.profiles] }))
    get().addToast('Profile created', 'success')
    return profile
  },
  deleteProfile: async (id) => {
    await profilesApi.deleteProfile(id)
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId
    }))
    get().addToast('Profile deleted', 'success')
  },

  // TTS
  generationText: '',
  isGenerating: false,
  currentGeneration: null,
  generations: [],
  setGenerationText: (text) => set({ generationText: text }),

  // Voice Design mode
  generationMode: 'clone',
  setGenerationMode: (mode) => set({ generationMode: mode }),
  voiceDesignInstruct: '',
  setVoiceDesignInstruct: (instruct) => set({ voiceDesignInstruct: instruct }),
  voiceDesignLanguage: localStorage.getItem('voicelab-vd-language') || 'English',
  setVoiceDesignLanguage: (language) => {
    localStorage.setItem('voicelab-vd-language', language)
    set({ voiceDesignLanguage: language })
  },

  // Custom Voice mode
  customVoiceSpeaker: localStorage.getItem('voicelab-cv-speaker') || 'Vivian',
  setCustomVoiceSpeaker: (speaker) => { localStorage.setItem('voicelab-cv-speaker', speaker); set({ customVoiceSpeaker: speaker }) },
  customVoiceLanguage: localStorage.getItem('voicelab-cv-language') || 'English',
  setCustomVoiceLanguage: (language) => { localStorage.setItem('voicelab-cv-language', language); set({ customVoiceLanguage: language }) },
  customVoiceInstruct: '',
  setCustomVoiceInstruct: (instruct) => set({ customVoiceInstruct: instruct }),

  // Generation Parameters
  genSpeed: parseFloat(localStorage.getItem('voicelab-gen-speed') || '1.0'),
  genNfeStep: parseInt(localStorage.getItem('voicelab-gen-nfe') || '32'),
  genCfgStrength: parseFloat(localStorage.getItem('voicelab-gen-cfg') || '2.0'),
  setGenSpeed: (v) => { localStorage.setItem('voicelab-gen-speed', String(v)); set({ genSpeed: v }) },
  setGenNfeStep: (v) => { localStorage.setItem('voicelab-gen-nfe', String(v)); set({ genNfeStep: v }) },
  setGenCfgStrength: (v) => { localStorage.setItem('voicelab-gen-cfg', String(v)); set({ genCfgStrength: v }) },

  generate: async () => {
    const {
      generationMode, selectedProfileId, generationText, profiles,
      genSpeed, genNfeStep, genCfgStrength,
      voiceDesignInstruct, voiceDesignLanguage
    } = get()

    if (generationMode === 'preset') {
      if (!generationText.trim() || !get().customVoiceSpeaker) return

      _generationAbort = new AbortController()
      set({ isGenerating: true, currentGeneration: null })
      try {
        const { customVoiceSpeaker, customVoiceLanguage, customVoiceInstruct } = get()
        const generation = await ttsApi.generateSpeech(
          {
            text: generationText,
            model: 'qwen3-tts-custom-voice',
            speaker: customVoiceSpeaker,
            language: customVoiceLanguage,
            ...(customVoiceInstruct.trim() ? { instruct: customVoiceInstruct } : {})
          },
          _generationAbort.signal
        )
        set((state) => ({
          currentGeneration: generation,
          generations: [generation, ...state.generations],
          isGenerating: false
        }))
        get().addToast('Speech generated', 'success')
      } catch (err: any) {
        if (axios.isCancel(err) || err?.name === 'CanceledError') {
          set({ isGenerating: false })
          get().addToast('Generation stopped', 'info')
          return
        }
        set({ isGenerating: false })
        const msg = err?.response?.data?.detail || 'Generation failed'
        get().addToast(msg, 'error')
      } finally {
        _generationAbort = null
      }
      return
    }

    if (generationMode === 'design') {
      // Voice Design mode — no profile needed
      if (!generationText.trim() || !voiceDesignInstruct.trim()) return

      _generationAbort = new AbortController()
      set({ isGenerating: true, currentGeneration: null })
      try {
        const generation = await ttsApi.generateSpeech(
          {
            text: generationText,
            model: 'qwen3-tts-voice-design',
            instruct: voiceDesignInstruct,
            language: voiceDesignLanguage
          },
          _generationAbort.signal
        )
        set((state) => ({
          currentGeneration: generation,
          generations: [generation, ...state.generations],
          isGenerating: false
        }))
        get().addToast('Speech generated', 'success')
      } catch (err: any) {
        if (axios.isCancel(err) || err?.name === 'CanceledError') {
          set({ isGenerating: false })
          get().addToast('Generation stopped', 'info')
          return
        }
        set({ isGenerating: false })
        const msg = err?.response?.data?.detail || 'Generation failed'
        get().addToast(msg, 'error')
      } finally {
        _generationAbort = null
      }
      return
    }

    // Clone mode — existing logic
    if (!selectedProfileId || !generationText.trim()) return

    const profile = profiles.find((p) => p.id === selectedProfileId)
    if (!profile) return

    const isHabibi = (profile.model || 'habibi-tts') === 'habibi-tts'

    _generationAbort = new AbortController()

    set({ isGenerating: true, currentGeneration: null })
    try {
      const generation = await ttsApi.generateSpeech(
        {
          profile_id: selectedProfileId,
          text: generationText,
          dialect: profile.dialect,
          ...(isHabibi ? { speed: genSpeed, nfe_step: genNfeStep, cfg_strength: genCfgStrength } : {})
        },
        _generationAbort.signal
      )
      set((state) => ({
        currentGeneration: generation,
        generations: [generation, ...state.generations],
        isGenerating: false
      }))
      get().addToast('Speech generated', 'success')
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError') {
        set({ isGenerating: false })
        get().addToast('Generation stopped', 'info')
        return
      }
      set({ isGenerating: false })
      const msg = err?.response?.data?.detail || 'Generation failed'
      get().addToast(msg, 'error')
    } finally {
      _generationAbort = null
    }
  },
  stopGeneration: () => {
    if (_generationAbort) {
      _generationAbort.abort()
      _generationAbort = null
    }
    // Also signal the backend to cancel/discard the in-progress generation
    ttsApi.cancelGeneration().catch(() => {})
  },
  fetchGenerations: async () => {
    if (!get().backendReady) return
    try {
      const generations = await ttsApi.fetchGenerations()
      set({ generations })
    } catch {
      // silent fail
    }
  },
  deleteGeneration: async (id) => {
    await ttsApi.deleteGeneration(id)
    set((state) => ({
      generations: state.generations.filter((g) => g.id !== id),
      currentGeneration: state.currentGeneration?.id === id ? null : state.currentGeneration
    }))
    get().addToast('Generation deleted', 'success')
  },
  prepareRegeneration: (generation) => {
    if (generation.model === 'qwen3-tts-custom-voice') {
      set({
        generationMode: 'preset',
        generationText: generation.text,
        customVoiceSpeaker: generation.speaker || 'Vivian',
        customVoiceLanguage: generation.language || 'English',
        customVoiceInstruct: generation.instruct || '',
        currentGeneration: null
      })
    } else if (generation.model === 'qwen3-tts-voice-design') {
      set({
        generationMode: 'design',
        generationText: generation.text,
        voiceDesignInstruct: generation.instruct || '',
        voiceDesignLanguage: generation.language || 'English',
        currentGeneration: null
      })
    } else {
      const profile = get().profiles.find((p) => p.id === generation.profile_id)
      set({
        generationMode: 'clone',
        generationText: generation.text,
        selectedProfileId: profile ? profile.id : null,
        currentGeneration: null
      })
      if (!profile) {
        get().addToast('Original profile not found — select a profile manually', 'info')
      }
    }
  },

  // UI
  toasts: [],
  addToast: (message, type) => {
    const id = Date.now().toString()
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  // STT
  sttModel: localStorage.getItem('voicelab-stt-model') || 'openai/whisper-large-v3-turbo',
  setSttModel: (model) => {
    localStorage.setItem('voicelab-stt-model', model)
    set({ sttModel: model })
  },
  sttModels: [],
  fetchSttModels: async () => {
    if (!get().backendReady) return
    try {
      const models = await sttApi.fetchSTTModels()
      set({ sttModels: models })
    } catch {
      // silent
    }
  },
  downloadSttModel: async (modelId) => {
    try {
      await sttApi.downloadSTTModel(modelId)
      get().addToast(`${modelId.split('/').pop()} downloaded`, 'success')
      await get().fetchSttModels()
    } catch (err: any) {
      get().addToast(err?.response?.data?.detail || 'Download failed', 'error')
      await get().fetchSttModels()
    }
  },
  deleteSttModel: async (modelId) => {
    try {
      await sttApi.deleteSTTModel(modelId)
      set({
        sttModels: get().sttModels.map((m) =>
          m.id === modelId ? { ...m, status: 'not_downloaded' as const } : m
        )
      })
      // If the deleted model was selected, keep the selection (user might download again)
      get().addToast(`${modelId.split('/').pop()} removed`, 'success')
    } catch (err: any) {
      get().addToast(err?.response?.data?.detail || 'Failed to remove model', 'error')
    }
  },

  // STT Transcription State
  sttTranscribing: false,
  sttResult: '',
  sttAudioBlob: null,
  sttAudioSource: 'record',
  setSttAudioBlob: (blob, source) => set({ sttAudioBlob: blob, sttAudioSource: source }),
  setSttAudioSource: (source) => set({ sttAudioSource: source }),
  setSttResult: (text) => set({ sttResult: text }),
  transcribe: async () => {
    const { sttAudioBlob, sttModel } = get()
    if (!sttAudioBlob) return

    _sttAbort = new AbortController()
    set({ sttTranscribing: true, sttResult: '' })

    try {
      const res = await sttApi.transcribeAudio(
        sttAudioBlob,
        sttModel,
        undefined,
        _sttAbort.signal,
        true // save to history
      )
      set({ sttResult: res.text, sttTranscribing: false })
      get().addToast('Transcription complete', 'success')
      // Refresh transcription history from backend to ensure consistency
      get().fetchTranscriptions()
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError') {
        set({ sttTranscribing: false })
        get().addToast('Transcription cancelled', 'info')
        return
      }
      set({ sttTranscribing: false })
      get().addToast(err?.response?.data?.detail || 'Transcription failed', 'error')
    } finally {
      _sttAbort = null
    }
  },
  stopTranscription: () => {
    if (_sttAbort) {
      _sttAbort.abort()
      _sttAbort = null
    }
  },
  clearSttSession: () => {
    if (_sttAbort) {
      _sttAbort.abort()
      _sttAbort = null
    }
    set({
      sttTranscribing: false,
      sttResult: '',
      sttAudioBlob: null,
      sttAudioSource: 'record' as const,
      ytUrl: '',
      ytState: 'idle' as const,
      ytInfo: null,
      ytError: '',
    })
  },

  // YouTube importer state
  ytUrl: '',
  ytState: 'idle',
  ytInfo: null,
  ytError: '',
  setYtUrl: (url) => set({ ytUrl: url }),
  setYtState: (state) => set({ ytState: state }),
  setYtInfo: (info) => set({ ytInfo: info }),
  setYtError: (error) => set({ ytError: error }),
  resetYtState: () => set({ ytState: 'idle' as const, ytInfo: null, ytError: '' }),

  // Transcription History
  transcriptions: [],
  fetchTranscriptions: async () => {
    if (!get().backendReady) return
    try {
      const transcriptions = await sttApi.fetchTranscriptions()
      set({ transcriptions })
    } catch {
      // silent
    }
  },
  deleteTranscription: async (id) => {
    try {
      await sttApi.deleteTranscription(id)
      set((state) => ({
        transcriptions: state.transcriptions.filter((t) => t.id !== id)
      }))
      get().addToast('Transcription deleted', 'success')
    } catch (err: any) {
      get().addToast(err?.response?.data?.detail || 'Failed to delete transcription', 'error')
    }
  },

  // App version & updates
  appVersion: '',
  updateStatus: 'idle' as UpdateStatus,
  updateVersion: '',
  updateProgress: 0,
  updateError: '',
  initUpdateListener: () => {
    window.api.getAppVersion().then((v) => set({ appVersion: v }))
    const cleanup = window.api.onUpdateStatus((data) => {
      set({ updateStatus: data.status })
      if (data.version) set({ updateVersion: data.version })
      if (data.percent !== undefined) set({ updateProgress: data.percent })
      if (data.message) set({ updateError: data.message })

      // Auto-reset transient statuses back to idle
      if (_updateResetTimer) clearTimeout(_updateResetTimer)
      if (data.status === 'up-to-date') {
        _updateResetTimer = setTimeout(() => set({ updateStatus: 'idle' }), 5000)
      }
    })
    return cleanup
  },
  checkForUpdates: async () => {
    set({ updateStatus: 'checking', updateError: '' })
    try {
      const result = await window.api.checkForUpdates()
      if (!result.success) {
        set({ updateStatus: 'error', updateError: result.error || 'Failed to check for updates' })
      }
    } catch {
      set({ updateStatus: 'error', updateError: 'Failed to check for updates' })
    }
  },
  downloadUpdate: async () => {
    set({ updateProgress: 0 })
    try {
      const result = await window.api.downloadUpdate()
      if (!result.success) {
        set({ updateStatus: 'error', updateError: result.error || 'Download failed' })
      }
    } catch {
      set({ updateStatus: 'error', updateError: 'Download failed' })
    }
  },
  installUpdate: () => {
    window.api.installUpdate()
  },

  // Developer
  devMode: localStorage.getItem('voicelab-dev-mode') === 'true',
  setDevMode: (enabled) => {
    localStorage.setItem('voicelab-dev-mode', enabled ? 'true' : 'false')
    set({ devMode: enabled })
  }
}))
