import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Download } from 'lucide-react'
import { cn, formatDuration } from '../../lib/utils'

interface AudioPlayerProps {
  url: string
  compact?: boolean
  onExport?: () => void
  className?: string
}

export default function AudioPlayer({ url, compact, onExport, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setReady(false)

    const audio = new Audio()

    const onCanPlay = () => {
      setReady(true)
      // For some formats loadedmetadata doesn't always fire,
      // so also grab duration on canplay
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => setPlaying(false)
    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('loadedmetadata', onMetadata)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    audio.src = url
    audio.load()
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
      audioRef.current = null
    }
  }, [url])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }, [playing])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('glass-card', compact ? 'p-3' : 'p-4', className)}>
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!ready}
          className="w-9 h-9 rounded-full bg-accent/15 hover:bg-accent/25 flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
        >
          {playing ? (
            <Pause className="w-4 h-4 text-accent-light" />
          ) : (
            <Play className="w-4 h-4 text-accent-light ml-0.5" />
          )}
        </button>

        <div className="flex-1 space-y-1.5">
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-surface-300 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-accent rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {onExport && (
          <button
            onClick={onExport}
            className="btn-ghost p-2"
            title="Export audio"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
