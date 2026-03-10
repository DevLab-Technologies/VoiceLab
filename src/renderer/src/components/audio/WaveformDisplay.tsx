import { useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

interface WaveformDisplayProps {
  data?: Float32Array | null
  peaks?: number[]
  color?: string
  height?: number
  className?: string
}

export default function WaveformDisplay({
  data,
  peaks,
  color = '#6366f1',
  height = 64,
  className
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const mid = h / 2

    ctx.clearRect(0, 0, w, h)

    if (peaks && peaks.length > 0) {
      // Static waveform from peaks
      const barWidth = w / peaks.length
      ctx.fillStyle = color

      for (let i = 0; i < peaks.length; i++) {
        const amp = peaks[i] * mid * 0.9
        const x = i * barWidth
        const barH = Math.max(amp, 1)
        ctx.fillRect(x, mid - barH, Math.max(barWidth - 1, 1), barH * 2)
      }
    } else if (data && data.length > 0) {
      // Live waveform from analyser
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()

      const sliceWidth = w / data.length
      let x = 0

      for (let i = 0; i < data.length; i++) {
        const v = data[i]
        const y = mid + v * mid * 0.8

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.stroke()
    } else {
      // Empty state - flat line
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(w, mid)
      ctx.stroke()
    }
  }, [data, peaks, color, height])

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full rounded-lg', className)}
      style={{ height }}
    />
  )
}
