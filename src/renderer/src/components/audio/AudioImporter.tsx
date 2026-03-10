import { Upload, FileAudio } from 'lucide-react'
import { useState, useRef } from 'react'

interface AudioImporterProps {
  onImported: (file: File) => void
}

export default function AudioImporter({ onImported }: AudioImporterProps) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setFileName(file.name)
    onImported(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      handleFile(file)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`glass-card-hover p-4 flex items-center gap-3 cursor-pointer transition-all ${
        dragOver ? 'border-accent/40 bg-accent/5' : ''
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleChange}
      />
      {fileName ? (
        <>
          <FileAudio className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">{fileName}</p>
          </div>
        </>
      ) : (
        <>
          <Upload className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-400">Import audio file</p>
            <p className="text-xs text-gray-600">MP3, WAV, OGG, FLAC</p>
          </div>
        </>
      )}
    </div>
  )
}
