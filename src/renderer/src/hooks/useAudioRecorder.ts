import { useState, useRef, useCallback } from 'react'

interface RecorderState {
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
  analyserData: Float32Array | null
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    analyserData: null
  })

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const chunks = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  const updateAnalyser = useCallback(() => {
    if (!analyser.current) return
    const data = new Float32Array(analyser.current.fftSize)
    analyser.current.getFloatTimeDomainData(data)
    setState((s) => ({ ...s, analyserData: data }))
    animFrameRef.current = requestAnimationFrame(updateAnalyser)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      audioContext.current = new AudioContext()
      const source = audioContext.current.createMediaStreamSource(stream)
      analyser.current = audioContext.current.createAnalyser()
      analyser.current.fftSize = 2048
      source.connect(analyser.current)

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      chunks.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType })
        console.log(`Recording complete: ${blob.size} bytes, type: ${blob.type}, chunks: ${chunks.current.length}`)
        const url = URL.createObjectURL(blob)
        setState((s) => ({ ...s, audioBlob: blob, audioUrl: url, isRecording: false }))
        stream.getTracks().forEach((t) => t.stop())
        cancelAnimationFrame(animFrameRef.current)
      }

      // No timeslice — collect all data at once for a valid WebM container
      recorder.start()
      mediaRecorder.current = recorder
      startTimeRef.current = Date.now()

      timerRef.current = window.setInterval(() => {
        setState((s) => ({
          ...s,
          duration: (Date.now() - startTimeRef.current) / 1000
        }))
      }, 100)

      setState((s) => ({
        ...s,
        isRecording: true,
        duration: 0,
        error: null,
        audioBlob: null,
        audioUrl: null
      }))

      updateAnalyser()
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: err.message || 'Microphone access denied'
      }))
    }
  }, [updateAnalyser])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    clearInterval(timerRef.current)
    if (audioContext.current) {
      audioContext.current.close()
      audioContext.current = null
    }
  }, [])

  const resetRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    setState({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
      analyserData: null
    })
  }, [state.audioUrl])

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording
  }
}
