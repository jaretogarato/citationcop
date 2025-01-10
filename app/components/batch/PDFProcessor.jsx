'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PDFQueueService } from '@/app/services/queue-service'
import { FileText, CheckCircle, XCircle, Loader } from 'lucide-react'
import { PDFDropZone } from './PDFDropZone'
import { ModeSelector } from '@/app/components/ui/ModeSelector'

const PDFProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isHighAccuracy, setIsHighAccuracy] = useState(true) // High accuracy enabled by default
  const [status, setStatus] = useState({
    pending: 0,
    processing: 0,
    complete: 0,
    error: 0
  })
  const queueServiceRef = useRef(null)

  useEffect(() => {
    // Initialize the queue service
    queueServiceRef.current = new PDFQueueService('/workers/pdf-worker.js')

    // Poll for status updates
    const interval = setInterval(() => {
      if (queueServiceRef.current) {
        setStatus(queueServiceRef.current.getStatus())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleFilesSelected = (files) => {
    setSelectedFiles(files)
  }

  const handleProcessFiles = () => {
    if (queueServiceRef.current && selectedFiles.length > 0) {
      setIsProcessing(true)
      queueServiceRef.current.addPDFs(selectedFiles, isHighAccuracy)
    }
  }

  const toggleHighAccuracy = (checked) => {
    setIsHighAccuracy(checked)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <PDFDropZone
          onFilesSelected={handleFilesSelected}
          isProcessing={isProcessing}
          onProcess={handleProcessFiles}
        />
      </div>

      <div className="mb-6">
        <ModeSelector
          isHighAccuracy={isHighAccuracy}
          onToggle={toggleHighAccuracy}
          disabled={isProcessing}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <FileText className="w-6 h-6 text-blue-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold">{status.pending}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <Loader className="w-6 h-6 text-yellow-500 mr-2 animate-spin" />
          <div>
            <p className="text-sm font-medium">Processing</p>
            <p className="text-2xl font-bold">{status.processing}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Complete</p>
            <p className="text-2xl font-bold">{status.complete}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <XCircle className="w-6 h-6 text-red-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Error</p>
            <p className="text-2xl font-bold">{status.error}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PDFProcessor
