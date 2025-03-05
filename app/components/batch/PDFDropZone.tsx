import { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react'

const ACCEPTED_TYPE = 'application/pdf'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB per file

interface BatchFileData {
  id: string
  file: File
  name: string
  size: number
}

interface PDFDropZoneProps {
  onFilesSelected: (files: File[]) => void
  isProcessing: boolean
  onProcess: () => void
}

export function PDFDropZone({
  onFilesSelected,
  isProcessing,
  onProcess
}: PDFDropZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<BatchFileData[]>([])
  const [isCollapsed, setIsCollapsed] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.type !== ACCEPTED_TYPE) {
      return 'Only PDF files are accepted'
    }
    if (file.size > MAX_SIZE) {
      return `File ${file.name} is too large. Maximum size is 10MB`
    }
    return null
  }

  const handleFiles = (newFiles: File[]) => {
    const validFiles: BatchFileData[] = []
    const errors: string[] = []

    for (const file of newFiles) {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size
        })
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    // First update the internal state
    const updatedFiles = [...files, ...validFiles]
    setFiles(updatedFiles)

    // Then notify parent with the complete list
    onFilesSelected(updatedFiles.map((f) => f.file))
    setError(null)
  }

  const removeFile = (id: string) => {
    // Same pattern for removeFile
    const updatedFiles = files.filter((file) => file.id !== id)
    setFiles(updatedFiles)
    onFilesSelected(updatedFiles.map((f) => f.file))
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) handleFiles(droppedFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) handleFiles(selectedFiles)
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300
          ${dragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800/50'}
          cursor-pointer`}
        role="button"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf"
          multiple
        />
        <div className="flex flex-col items-center gap-6">
          {files.length === 0 && (
            <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
              <Upload className="w-12 h-12 text-white" />
            </div>
          )}
          <div>
            <p className="text-lg font-medium text-white mb-1">
              {files.length > 0
                ? `${files.length} file${files.length === 1 ? '' : 's'} selected`
                : 'Drop your PDF files here'}
            </p>
            <p className="text-sm text-gray-400">
              Supports multiple PDF files up to 10MB each.
            </p>
            <br></br>
            <p className="text-sm text-gray-400">
              Note: This tool only works with PDFs with a{' '}
              <em>clearly labeled references section</em>. It does not extract
              footnotes.{' '}
            </p>
            <p className="text-sm text-gray-400">
              If the system doesn't find all references, you can try again or
              manually copy-paste them.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm whitespace-pre-line">{error}</div>
      )}

      {files.length > 0 && !isProcessing && (
        <button
          onClick={onProcess}
          className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Process {files.length} File{files.length === 1 ? '' : 's'}
        </button>
      )}

      {files.length > 0 && (
        <div>
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-2 text-indigo-500 hover:text-indigo-400"
          >
            {isCollapsed ? <ChevronDown /> : <ChevronUp />}
            {isCollapsed ? 'Show files' : 'Hide files'}
          </button>

          {!isCollapsed && (
            <div className="max-h-40 overflow-y-auto space-y-2 mt-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(file.size / (1024 * 1024)).toFixed(2)}MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PDFDropZone
