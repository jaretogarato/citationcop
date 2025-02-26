'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PDFQueueService } from '@/app/services/queue-service'
import { FileText, CheckCircle, XCircle, Cog } from 'lucide-react'
import { PDFDropZone } from './PDFDropZone'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'
import type { Reference } from '@/app/types/reference'

const PDFProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  //const [isHighAccuracy, setIsHighAccuracy] = useState(true)
  const [status, setStatus] = useState({
    pending: 0,
    processing: 0,
    complete: 0,
    error: 0
  })
  const [logMessages, setLogMessages] = useState<string[]>([])
  const queueServiceRef = useRef<PDFQueueService | null>(null)
  const [references, setReferences] = useState<Reference[]>([])

  useEffect(() => {
    // Initialize the queue service
    queueServiceRef.current = new PDFQueueService('/workers/verification-worker.js')

    // Listen for updates from the queue
    queueServiceRef.current.onUpdate((message) => {
      switch (message.type) {
        case 'update':
          setLogMessages((prev) => [...prev, `${message.message}`])
          break

        case 'references':
          setLogMessages((prev) => [...prev, `${message.message}`])
          break

        case 'complete':
          console.log('Complete message received:', message)
          console.log('Processed references:', message.references?.length) // Add this

          setLogMessages((prev) => [
            ...prev,
            `✅ Processing complete for PDF ${message.pdfId}`
            /*`Verified References for PDF ${message.pdfId}:`,
            ...(message.references || []).map(
              (ref, index) => `  ${index + 1}. ${JSON.stringify(ref, null, 2)}`
            )*/
          ])

          setReferences((prev) => [
            ...prev,
            ...(message.references || []).map((ref) => ({
              ...ref,
              sourceDocument: message.pdfId
            }))
          ])

          updateProcessingState()
          break

        case 'error':
          console.error('PDF Processor, error message received:', message)
          setLogMessages((prev) => [
            ...prev,
            `❌ Error processing PDF ${message.pdfId}: ${message.error}`
          ])
          updateProcessingState()
          break

        default:
          console.warn('Unknown message type:', message.type)
      }
    })

    // Poll for status updates
    const interval = setInterval(() => {
      if (queueServiceRef.current) {
        setStatus(queueServiceRef.current.getStatus())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files)
  }

  const handleProcessFiles = () => {
    if (queueServiceRef.current && selectedFiles.length > 0) {
      setIsProcessing(true)
      queueServiceRef.current.addPDFs(selectedFiles)
    }
  }

  /*const toggleHighAccuracy = (checked: boolean) => {
    setIsHighAccuracy(checked)
  }*/

  const updateProcessingState = () => {
    if (queueServiceRef.current) {
      const { processing, pending } = queueServiceRef.current.getStatus()
      setIsProcessing(processing > 0)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <PDFDropZone
          onFilesSelected={handleFilesSelected}
          isProcessing={isProcessing}
          onProcess={handleProcessFiles}
        />
      </div>

     {/*} <div className="mb-6">
        <ModeSelector
          //isHighAccuracy={isHighAccuracy}
          onToggle={toggleHighAccuracy}
          disabled={isProcessing}
        />
      </div>*/}

      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2 md:grid-cols-4">
        {[
          {
            icon: <FileText className="w-8 h-8 text-blue-500" />,
            label: 'Pending',
            value: status.pending,
            bg: 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400'
          },
          {
            icon: (
              <Cog
                className={`w-8 h-8 text-yellow-500 ${isProcessing ? 'animate-spin' : ''}`}
              />
            ),
            label: 'Processing',
            value: status.processing,
            bg: 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400'
          },
          {
            icon: <CheckCircle className="w-8 h-8 text-green-500" />,
            label: 'Complete',
            value: status.complete,
            bg: 'bg-gradient-to-r from-green-600 via-green-500 to-green-400'
          },
          {
            icon: <XCircle className="w-8 h-8 text-red-500" />,
            label: 'Error',
            value: status.error,
            bg: 'bg-gradient-to-r from-red-600 via-red-500 to-red-400'
          }
        ].map(({ icon, label, value, bg }, index) => (
          <div
            key={index}
            className={`flex items-center p-4 rounded-lg shadow-lg ${bg}`}
          >
            <div className="flex-shrink-0 mr-4">{icon}</div>
            <div>
              <p className="text-lg font-semibold text-white">{label}</p>
              <p className="text-3xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {references.length > 0 && (
        <div className="mt-6 mb-6">
          <ReferenceGrid references={references} />
        </div>
      )}

      <div className="mt-6 bg-gray-900 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Logs</h3>
        <div className="h-40 overflow-y-auto bg-gray-800 p-4 rounded">
          {logMessages.map((msg, index) => (
            <p key={index} className="text-sm text-gray-200">
              {msg}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PDFProcessor
