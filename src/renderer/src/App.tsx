import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoadingScreen from './components/layout/LoadingScreen'
import TTSPage from './pages/TTSPage'
import ProfilesPage from './pages/ProfilesPage'
import NewProfilePage from './pages/NewProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import HistoryPage from './pages/HistoryPage'
import STTPage from './pages/STTPage'
import ModelsPage from './pages/ModelsPage'
import SettingsPage from './pages/SettingsPage'
import { useAppStore } from './store'
import { initApiClient } from './api/client'

export default function App() {
  const { pollHealth, backendReady, modelLoaded, modelStatus } = useAppStore()

  useEffect(() => {
    // Initialize API client with the correct backend port
    initApiClient().then(() => {
      // Start polling health
      pollHealth()
    })
  }, [])

  // Poll health every 2 seconds until backend ready, then every 10 seconds
  useEffect(() => {
    const interval = setInterval(pollHealth, backendReady ? 10000 : 2000)
    return () => clearInterval(interval)
  }, [pollHealth, backendReady])

  // Show loading screen until backend is up
  // Models are loaded on-demand when the user generates speech
  if (!backendReady) {
    return (
      <LoadingScreen backendReady={backendReady} />
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TTSPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/profiles/new" element={<NewProfilePage />} />
        <Route path="/profiles/:id/edit" element={<EditProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/stt" element={<STTPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
