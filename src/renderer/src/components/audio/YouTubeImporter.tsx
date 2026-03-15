import { useState } from 'react'
import { Link2, Loader2, Play, Download, Clock, User, AlertCircle } from 'lucide-react'
import { fetchVideoInfo, extractAudio, type VideoInfo } from '../../api/youtube'

type State = 'idle' | 'loading-info' | 'preview' | 'extracting' | 'done' | 'error'

interface YouTubeImporterProps {
  onExtracted: (blob: Blob, metadata: { title: string; duration: number }) => void
  maxDuration?: number
  enableTrimming?: boolean
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function YouTubeImporter({
  onExtracted,
  maxDuration,
  enableTrimming = false,
}: YouTubeImporterProps) {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>('idle')
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState('')
  const [startSec, setStartSec] = useState<number>(0)
  const [endSec, setEndSec] = useState<number>(15)

  const handleLoad = async () => {
    if (!url.trim()) return
    setState('loading-info')
    setError('')
    try {
      const videoInfo = await fetchVideoInfo(url.trim())
      setInfo(videoInfo)
      setEndSec(maxDuration ? Math.min(videoInfo.duration, maxDuration) : videoInfo.duration)
      setState('preview')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch video info')
      setState('error')
    }
  }

  const handleExtract = async () => {
    setState('extracting')
    setError('')
    try {
      const trimStart = enableTrimming ? startSec : undefined
      const trimEnd = enableTrimming ? endSec : undefined
      const { audioBlob, title, duration } = await extractAudio(
        url.trim(),
        trimStart,
        trimEnd
      )
      setState('done')
      onExtracted(audioBlob, { title, duration })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to extract audio')
      setState('error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state === 'idle') handleLoad()
  }

  const handleReset = () => {
    setState('idle')
    setInfo(null)
    setError('')
  }

  return (
    <div className="space-y-3">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (state !== 'idle') handleReset() }}
            onKeyDown={handleKeyDown}
            placeholder="Paste YouTube URL..."
            className="input-field pl-9 text-sm"
            disabled={state === 'extracting'}
          />
        </div>
        {state === 'idle' || state === 'error' ? (
          <button
            onClick={handleLoad}
            disabled={!url.trim()}
            className="btn-primary px-4 text-sm"
          >
            Load
          </button>
        ) : state === 'loading-info' ? (
          <button disabled className="btn-primary px-4 text-sm opacity-70">
            <Loader2 className="w-4 h-4 animate-spin" />
          </button>
        ) : null}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Video Preview Card */}
      {info && (state === 'preview' || state === 'extracting' || state === 'done') && (
        <div className="glass-card p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-200 line-clamp-2">{info.title}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {info.channel}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(info.duration)}
              </span>
            </div>
          </div>

          {/* Trimming Controls */}
          {enableTrimming && state === 'preview' && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">Trim:</label>
              <input
                type="number"
                min={0}
                max={endSec - 1}
                value={startSec}
                onChange={(e) => setStartSec(Math.max(0, Number(e.target.value)))}
                className="input-field w-20 text-xs px-2 py-1"
                placeholder="Start"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="number"
                min={startSec + 1}
                max={maxDuration || info.duration}
                value={endSec}
                onChange={(e) => setEndSec(Math.min(maxDuration || info.duration, Number(e.target.value)))}
                className="input-field w-20 text-xs px-2 py-1"
                placeholder="End"
              />
              <span className="text-xs text-gray-500">sec</span>
            </div>
          )}

          {/* Extract Button */}
          {state === 'preview' && (
            <button onClick={handleExtract} className="btn-primary w-full text-sm flex items-center justify-center gap-2 py-2">
              <Download className="w-4 h-4" />
              Extract Audio
            </button>
          )}

          {state === 'extracting' && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Extracting audio...
            </div>
          )}

          {state === 'done' && (
            <div className="flex items-center justify-center gap-2 text-sm text-success py-2">
              <Play className="w-4 h-4" />
              Audio extracted
            </div>
          )}
        </div>
      )}
    </div>
  )
}
