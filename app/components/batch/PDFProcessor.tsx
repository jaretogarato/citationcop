'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PDFQueueService } from '@/app/services/queue-service'
import {
  FileText,
  CheckCircle,
  XCircle,
  Cog,
  DownloadCloud,
  RefreshCw
} from 'lucide-react'
import { PDFDropZone } from './PDFDropZone'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'
import type {
  Reference,
  ReferenceStatus,
  Document
} from '@/app/types/reference'
import StatusDisplay from '@/app/components/reference-display/StatusDisplay'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import Button from '@/app/components/ui/Button'
import {
  exportReferencesToCSV,
  exportReferencesToExcel
} from '@/app/utils/reference-helpers/reference-export-utility'

const PDFProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [allProcessingComplete, setAllProcessingComplete] = useState(false)
  const [status, setStatus] = useState({
    pending: 0,
    processing: 0,
    complete: 0,
    error: 0
  })
  const [logMessages, setLogMessages] = useState<string[]>([])
  const queueServiceRef = useRef<PDFQueueService | null>(null)

  // Instead of a flat references array, we maintain a documents array.
  // Each Document holds the pdfId and an array of references in the intended order.
  const [documents, setDocuments] = useState<Document[]>([])

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
    // Initialize the queue service with your worker script
    queueServiceRef.current = new PDFQueueService(
      '/workers/verification-worker.js'
    )

    // Register the completion callback
    if (queueServiceRef.current) {
      queueServiceRef.current.onAllComplete(() => {
        //console.log('Queue service signaled all processing complete')
        setAllProcessingComplete(true)
        setIsProcessing(false)

        // Add a notification to the log messages
        setLogMessages((prev) => [
          ...prev,
          '✅ All PDFs have been processed. You can now export the results or start a new batch.'
        ])
      })
    }

    queueServiceRef.current.onUpdate((message) => {
      switch (message.type) {
        case 'update':
          setLogMessages((prev) => [...prev, `${message.message}`])
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

        case 'batch-complete':
          // This is a new message type from the queue service
          setLogMessages((prev) => [...prev, `${message.message}`])
          setIsProcessing(false)
          setAllProcessingComplete(true)
          break

        case 'references':
          setLogMessages((prev) => [...prev, `${message.message}`])
          if (message.noReferences && message.pdfId) {
            // Track the total number of references for this PDF
            setReferenceCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: message.noReferences
            }))
            setVerifiedCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: 0
            }))

            setCurrentJobs((prev) => {
              const newJobs = new Map(prev)
              const existing = newJobs.get(message.pdfId)
              if (existing) {
                newJobs.set(message.pdfId, {
                  ...existing,
                  message: message.message,
                  timestamp: new Date()
                })
              }
              return newJobs
            })

            // Create placeholders for the references.
            // The id is constructed as `${pdfId}-${index}` so that we can later match the correct position.

            // Assume extractedRefs is an array of extracted references from the worker
            const placeholderRefs: Reference[] = message.references.map(
              (ref, index) => ({
                id: `${message.pdfId}-${index}`,
                // Pre-populate with available data from extraction
                title: ref.title || `Reference #${index + 1}`,
                authors: ref.authors || [],
                year: ref.year || '',
                raw: ref.raw || '',
                sourceDocument: message.pdfId,
                status: 'pending' as ReferenceStatus,
                date_of_access: ''
                // (Optional) you can add other details from the extracted ref if available
              })
            )

            //console.log('Placeholder refs:', placeholderRefs)
            //console.log('PH 0:', placeholderRefs[0].id)
            //console.log('PH 1:', placeholderRefs[1].id)

            // Update documents state for this pdfId.
            setDocuments((prevDocs) => {
              // Remove any existing document for this pdfId and add the new one
              const otherDocs = prevDocs.filter(
                (doc) => doc.pdfId !== message.pdfId
              )
              return [
                ...otherDocs,
                { pdfId: message.pdfId, references: placeholderRefs }
              ]
            })
          }
          break

        case 'reference-verified':
          // Only process if this PDF hasn't already completed
          if (!completedPdfs.has(message.pdfId)) {
            setLogMessages((prev) => [
              ...prev,
              `Completed: ${message.pdfId}: ${message.verifiedReference?.title || 'Unknown'}`
            ])

            //console.log('Reference verified:', message.verifiedReference)
            //console.log('Processed references:', message.verifiedReference?.id)

            setVerifiedCountByPdf((prev) => ({
              ...prev,
              [message.pdfId]: (prev[message.pdfId] || 0) + 1
            }))

            setCurrentJobs((prev) => {
              const newJobs = new Map(prev)
              const existing = newJobs.get(message.pdfId)
              if (existing) {
                const totalRefs = referenceCountByPdf[message.pdfId] || 1 // prevent division by zero
                const verifiedRefs =
                  (verifiedCountByPdf[message.pdfId] || 0) + 1
                const progress = 10 + 90 * (verifiedRefs / totalRefs)
                newJobs.set(message.pdfId, {
                  ...existing,
                  message: `Verified reference: ${message.verifiedReference?.title || 'Unknown'}`,
                  timestamp: new Date(),
                  progress: Math.min(progress, 99)
                })
              }
              return newJobs
            })

            if (message.verifiedReference) {
              // Format the id so that it includes the pdfId and index.
              const refId =
                message.verifiedReference.id !== undefined &&
                message.verifiedReference.id !== null
                  ? String(message.verifiedReference.id)
                  : ''
              const verifiedRefWithCorrectId = {
                ...message.verifiedReference,
                id: refId.includes(message.pdfId)
                  ? refId
                  : `${message.pdfId}-${refId}`
              }

              // Update the document's references array.
              setDocuments((prevDocs) =>
                prevDocs.map((doc) => {
                  if (doc.pdfId === message.pdfId) {
                    // Look for a placeholder whose id matches.
                    const newRefs = doc.references.map((ref) => {
                      if (
                        ref.id === verifiedRefWithCorrectId.id &&
                        ref.status === 'pending'
                      ) {
                        return verifiedRefWithCorrectId
                      }
                      return ref
                    })
                    // If no placeholder was found, fallback to appending.
                    if (
                      !newRefs.find((r) => r.id === verifiedRefWithCorrectId.id)
                    ) {
                      return {
                        ...doc,
                        references: [
                          ...doc.references,
                          verifiedRefWithCorrectId
                        ]
                      }
                    }
                    return { ...doc, references: newRefs }
                  }
                  return doc
                })
              )
            }
          }
          break

        case 'complete':
          //console.log('Complete message received:', message)
          //console.log('Processed references:', message.references?.length)
          setLogMessages((prev) => [
            ...prev,
            `✅ Processing complete for PDF ${message.pdfId}`
          ])
          setCompletedPdfs((prev) => {
            const newSet = new Set(prev)
            newSet.add(message.pdfId)
            return newSet
          })
          setCurrentJobs((prev) => {
            const newJobs = new Map(prev)
            newJobs.set(message.pdfId, {
              pdfId: message.pdfId,
              status: 'complete',
              message: `Completed processing references`,
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
          break

        case 'error':
          console.error('PDF Processor, error message received:', message)
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
          break

        default:
          console.warn('Unknown message type:', message.type)
      }
    })

    const interval = setInterval(() => {
      if (queueServiceRef.current) {
        setStatus(queueServiceRef.current.getStatus())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [completedPdfs, referenceCountByPdf, verifiedCountByPdf])

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files)
  }

  const handleProcessFiles = () => {
    if (queueServiceRef.current && selectedFiles.length > 0) {
      setIsProcessing(true)
      setAllProcessingComplete(false)
      // Reset PDF-specific tracking for each new file
      selectedFiles.forEach((file) => {
        const pdfId = file.name

        setReferenceCountByPdf((prev) => ({ ...prev, [pdfId]: 0 }))
        setVerifiedCountByPdf((prev) => ({ ...prev, [pdfId]: 0 }))

        setProcessedReferenceIds((prev) => {
          const newSet = new Set(prev)
          Array.from(prev).forEach((id) => {
            if (id.toString().startsWith(pdfId)) {
              newSet.delete(id)
            }
          })
          return newSet
        })

        setCompletedPdfs((prev) => {
          const newSet = new Set(prev)
          newSet.delete(pdfId)
          return newSet
        })
      })

      queueServiceRef.current.addPDFs(selectedFiles)
    }
  }

  const handleReset = () => {
    setSelectedFiles([])
    setLogMessages([])
    setDocuments([])
    setProcessedReferenceIds(new Set())
    setCompletedPdfs(new Set())
    setCurrentJobs(new Map())
    setReferenceCountByPdf({})
    setVerifiedCountByPdf({})
    setAllProcessingComplete(false)

    // Reset queue service status
    if (queueServiceRef.current) {
      queueServiceRef.current.reset()
      setStatus({
        pending: 0,
        processing: 0,
        complete: 0,
        error: 0
      })
    }
  }

  // Instead of defining export functions here, we now just pass the documents to the utility functions
  const handleExportCSV = () => {
    exportReferencesToCSV(documents)
  }

  const handleExportExcel = async () => {
    await exportReferencesToExcel(documents)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-200">
          PDF Reference Processor
        </h2>
      </div>

      {!allProcessingComplete && (
        <div className="mb-8">
          <PDFDropZone
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
            onProcess={handleProcessFiles}
          />
        </div>
      )}

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

      {allProcessingComplete && (
        <div className="flex justify-end gap-2 mb-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-indigo-700 hover:bg-indigo-600 text-white">
                <DownloadCloud className="h-4 w-4 mr-2" />
                Export References
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleReset}
            className="bg-indigo-700 hover:bg-indigo-600 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Start New Batch
          </Button>
        </div>
      )}

      {/* Render a ReferenceGrid for each document */}
      {documents.length > 0 &&
        documents.map((doc) => (
          <div key={doc.pdfId} className="mt-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              References for {doc.pdfId}
            </h3>
            <ReferenceGrid references={doc.references} />
          </div>
        ))}

      <StatusDisplay logMessages={logMessages} currentJobs={currentJobs} />
    </div>
  )
}

export default PDFProcessor
