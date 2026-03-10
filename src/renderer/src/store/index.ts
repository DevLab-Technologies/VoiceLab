import { create } from 'zustand'
import type { Profile } from '../types/profile'
import type { Generation } from '../types/tts'
import type { DialectCode } from '../types/dialect'
import type { ModelId, ModelInfo } from '../types/model'
import * as profilesApi from '../api/profiles'
import * as ttsApi from '../api/tts'
import * as audioApi from '../api/audio'
import * as modelsApi from '../api/models'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppState {
  // Backend
  backendReady: boolean
  modelLoaded: boolean
  modelStatus: string
  initialDataLoaded: boolean
  setBackendReady: (ready: boolean) => void
  setModelLoaded: (loaded: boolean) => void
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
  fetchGenerations: () => Promise<void>
  deleteGeneration: (id: string) => Promise<void>

  // UI
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  dismissToast: (id: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Backend
  backendReady: false,
  modelLoaded: false,
  modelStatus: 'idle',
  initialDataLoaded: false,
  setBackendReady: (ready) => set({ backendReady: ready }),
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),
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
  generate: async () => {
    const { selectedProfileId, generationText, profiles } = get()
    if (!selectedProfileId || !generationText.trim()) return

    const profile = profiles.find((p) => p.id === selectedProfileId)
    if (!profile) return

    set({ isGenerating: true })
    try {
      const generation = await ttsApi.generateSpeech({
        profile_id: selectedProfileId,
        text: generationText,
        dialect: profile.dialect
      })
      set((state) => ({
        currentGeneration: generation,
        generations: [generation, ...state.generations],
        isGenerating: false
      }))
      get().addToast('Speech generated', 'success')
    } catch (err: any) {
      set({ isGenerating: false })
      const msg = err?.response?.data?.detail || 'Generation failed'
      get().addToast(msg, 'error')
    }
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
  }
}))
