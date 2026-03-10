import { useEffect, useRef } from 'react'
import { Mic, Square, RotateCcw, AlertCircle } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { formatDuration } from '../../lib/utils'
import WaveformDisplay from './WaveformDisplay'
import AudioPlayer from './AudioPlayer'

const MIN_DURATION_SEC = 3

interface AudioRecorderProps {
  onRecorded: (blob: Blob) => void
  existingAudioUrl?: string | null
}

export default function AudioRecorder({ onRecorded, existingAudioUrl }: AudioRecorderProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    analyserData,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder()

  // Notify parent when a valid recording is ready (via useEffect, not during render)
  const lastBlobRef = useRef<Blob | null>(null)
  useEffect(() => {
    if (audioBlob && audioBlob !== lastBlobRef.current) {
      lastBlobRef.current = audioBlob
      onRecorded(audioBlob)
    }
  }, [audioBlob, onRecorded])

  const tooShort = isRecording && duration < MIN_DURATION_SEC
  const displayUrl = audioUrl || existingAudioUrl

  return (
    <div className="space-y-3">
      {isRecording ? (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-danger rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-300">Recording</span>
              <span className={`text-sm font-mono ${tooShort ? 'text-warning' : 'text-success'}`}>
                {formatDuration(duration)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              disabled={tooShort}
              className="btn-danger flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
          <WaveformDisplay data={analyserData} color="#ef4444" height={48} />
          {tooShort && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Record at least {MIN_DURATION_SEC} seconds for best results
            </div>
          )}
        </div>
      ) : displayUrl ? (
        <div className="space-y-3">
          <AudioPlayer url={displayUrl} compact />
          <button
            onClick={resetRecording}
            className="btn-ghost flex items-center gap-2 text-sm text-gray-400"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-record
          </button>
        </div>
      ) : (
        <button
          onClick={startRecording}
          className="glass-card-hover w-full p-6 flex flex-col items-center gap-3 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Mic className="w-5 h-5 text-accent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">Click to record</p>
            <p className="text-xs text-gray-500 mt-1">Record 5-15 seconds for best quality</p>
          </div>
        </button>
      )}

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
    </div>
  )
}
