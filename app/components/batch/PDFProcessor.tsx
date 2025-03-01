'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PDFQueueService } from '@/app/services/queue-service'
import { FileText, CheckCircle, XCircle, Cog } from 'lucide-react'
import { PDFDropZone } from './PDFDropZone'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
import StatusDisplay from './StatusDisplay'

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
  const [processedReferenceIds, setProcessedReferenceIds] = useState<
    Set<string>
  >(new Set())
  const [completedPdfs, setCompletedPdfs] = useState<Set<string>>(new Set())

  const [currentJobs, setCurrentJobs] = useState<
    Map<
      string,
      {
        pdfId: string
        status: 'processing' | 'complete' | 'error'
        message: string
        timestamp: Date
        progress?: number
      }
    >
  >(new Map())
  const [referenceCountByPdf, setReferenceCountByPdf] = useState<
    Record<string, number>
  >({})
  const [verifiedCountByPdf, setVerifiedCountByPdf] = useState<
    Record<string, number>
  >({})

  useEffect(() => {
    // Initialize the queue service
    queueServiceRef.current = new PDFQueueService(
      '/workers/verification-worker.js'
    )

    // Listen for updates from the queue
    queueServiceRef.current.onUpdate((message) => {
      switch (message.type) {
        case 'update':
          setLogMessages((prev) => [...prev, `${message.message}`])

          // Update current job status
          setCurrentJobs((prev) => {
            const newJobs = new Map(prev)
            newJobs.set(message.pdfId, {
              pdfId: message.pdfId,
              status: 'processing',
              message: message.message,
              timestamp: new Date()
            })
            return newJobs
          })
          break

        case 'references':
          setLogMessages((prev) => [...prev, `${message.message}`])

          // Store the total number of references for this PDF
          if (message.noReferences && message.pdfId) {
            setReferenceCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: message.noReferences
            }))

            // Initialize verified count to 0
            setVerifiedCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: 0
            }))

            // Update job with reference count information
            setCurrentJobs((prev) => {
              const newJobs = new Map(prev)
              const existing = newJobs.get(message.pdfId)
              if (existing) {
                newJobs.set(message.pdfId, {
                  ...existing,
                  message: message.message,
                  timestamp: new Date(),
                  progress: 10 // Just found references, starting process
                })
              }
              return newJobs
            })

            // Create placeholder references based on the count
            const placeholderRefs: Reference[] = Array(message.noReferences)
              .fill(null)
              .map((_, index) => ({
                // Make sure ID is unique across PDFs
                id: `${message.pdfId}-${index}`, // Use a string ID that includes PDF ID
                title: `Reference #${index + 1}`,
                authors: [],
                year: '',
                sourceDocument: message.pdfId,
                status: 'pending' as ReferenceStatus,
                date_of_access: '',
                raw: ''
              }))

            setReferences((prev) => [
              ...prev.filter(
                (ref) =>
                  !(
                    ref.sourceDocument === message.pdfId &&
                    ref.status === 'pending'
                  )
              ),
              ...placeholderRefs
            ])
          }
          break

        case 'reference-verified':
          // Only process if this PDF hasn't already completed
          if (!completedPdfs.has(message.pdfId)) {
            setLogMessages((prev) => [
              ...prev,
              `Verified reference from ${message.pdfId}: ${message.verifiedReference?.title || 'Unknown'}`
            ])

            // Increment the count of verified references for this PDF
            setVerifiedCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: (prev[message.pdfId] || 0) + 1
            }))

            // Update job progress based on verification count
            setCurrentJobs((prev) => {
              const newJobs = new Map(prev)
              const existing = newJobs.get(message.pdfId)

              if (existing) {
                // Calculate progress: 10% for finding refs + up to 90% for verification progress
                const totalRefs = referenceCountByPdf[message.pdfId] || 1 // Prevent division by zero
                const verifiedRefs =
                  (verifiedCountByPdf[message.pdfId] || 0) + 1 // Add 1 for current reference

                const progress = 10 + 90 * (verifiedRefs / totalRefs)

                newJobs.set(message.pdfId, {
                  ...existing,
                  message: `Verified reference: ${message.verifiedReference?.title || 'Unknown'} (${verifiedRefs}/${totalRefs})`,
                  timestamp: new Date(),
                  progress: Math.min(progress, 99) // Cap at 99% until complete
                })
              }
              return newJobs
            })

            if (message.verifiedReference) {
              // Safely handle the ID format
              const refId =
                message.verifiedReference.id !== undefined &&
                message.verifiedReference.id !== null
                  ? String(message.verifiedReference.id)
                  : ''

              const verifiedRefWithCorrectId = {
                ...message.verifiedReference,
                // Make sure the ID has the correct format
                id: refId.includes(message.pdfId)
                  ? refId
                  : `${message.pdfId}-${refId}`
              }

              // Update the references array
              setReferences((prev) => {
                // Get all pending references for this PDF
                const pendingReferences = prev.filter(
                  (ref) =>
                    ref.sourceDocument === message.pdfId &&
                    ref.status === 'pending' &&
                    !processedReferenceIds.has(String(ref.id))
                )

                // If we don't have any pending references left, just add the new one
                if (pendingReferences.length === 0) {
                  return [...prev, verifiedRefWithCorrectId]
                }

                // Get the first pending reference to replace
                const referenceToReplace = pendingReferences[0]

                // Mark this reference as processed
                setProcessedReferenceIds((current) => {
                  const newSet = new Set(current)
                  newSet.add(String(referenceToReplace.id))
                  return newSet
                })

                // Return a new array with the reference replaced
                return prev.map((ref) =>
                  ref.id === referenceToReplace.id
                    ? verifiedRefWithCorrectId
                    : ref
                )
              })
            }
          }
          break

        // Update the complete case to better handle duplication
        case 'complete':
          console.log('Complete message received:', message)
          console.log('Processed references:', message.references?.length)

          setLogMessages((prev) => [
            ...prev,
            `✅ Processing complete for PDF ${message.pdfId}`
          ])

          // Mark this PDF as completed
          setCompletedPdfs((prev) => {
            const newSet = new Set(prev)
            newSet.add(message.pdfId)
            return newSet
          })

          // Update the status display
          setCurrentJobs((prev) => {
            const newJobs = new Map(prev)
            const totalRefs = referenceCountByPdf[message.pdfId] || 0

            newJobs.set(message.pdfId, {
              pdfId: message.pdfId,
              status: 'complete',
              message: `Completed processing ${totalRefs} references`,
              timestamp: new Date(),
              progress: 100
            })

            // Remove completed jobs after 5 seconds
            setTimeout(() => {
              setCurrentJobs((current) => {
                const updatedJobs = new Map(current)
                updatedJobs.delete(message.pdfId)
                return updatedJobs
              })
            }, 5000)

            return newJobs
          })

          // No need to touch references at all - they should all be updated already

          updateProcessingState()
          break

        case 'error':
          console.error('PDF Processor, error message received:', message)
          // Update job to error state
          setCurrentJobs((prev) => {
            const newJobs = new Map(prev)
            newJobs.set(message.pdfId, {
              pdfId: message.pdfId,
              status: 'error',
              message: message.error || 'Unknown error',
              timestamp: new Date()
            })
            return newJobs
          })
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

      // Reset PDF-specific tracking for each new file
      selectedFiles.forEach((file) => {
        const pdfId = file.name

        // Reset counts for this PDF
        setReferenceCountByPdf((prev) => ({
          ...prev,
          [pdfId]: 0
        }))

        setVerifiedCountByPdf((prev) => ({
          ...prev,
          [pdfId]: 0
        }))

        // Clear any existing processed reference IDs for this PDF
        setProcessedReferenceIds((prev) => {
          const newSet = new Set(prev)
          // Remove any IDs that start with this PDF's ID
          Array.from(prev).forEach((id) => {
            if (id.toString().startsWith(pdfId)) {
              newSet.delete(id)
            }
          })
          return newSet
        })

        // Remove this PDF from completed set if it was there
        setCompletedPdfs((prev) => {
          const newSet = new Set(prev)
          newSet.delete(pdfId)
          return newSet
        })
      })

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

      <StatusDisplay logMessages={logMessages} currentJobs={currentJobs} />
    </div>
  )
}

export default PDFProcessor
