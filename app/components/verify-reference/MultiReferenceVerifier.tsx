'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/app/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { StatusSummaryBar } from '@/app/components/verify-reference/StatusSummaryBar'
import StatusDisplay from '@/app/components/reference-display/StatusDisplay'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'

// Import the enhanced o3 service
import { o3ReferenceVerificationService } from '@/app/services/o3-reference-verification-service'
import { ReferenceExtractFromTextService } from '@/app/services/reference-extract-from-text-service'

import type { Reference } from '@/app/types/reference'
import { FileText } from 'lucide-react'

type ProcessingStatus =
  | 'idle'
  | 'extracting'
  | 'processing'
  | 'complete'
  | 'error'

type StatusItem = {
  pdfId: string
  status: 'processing' | 'complete' | 'error'
  message: string
  timestamp: Date
  progress?: number
}

// Maximum text length constant
const MAX_TEXT_LENGTH = 10000

export default function MultiReferenceVerifier() {
  const [bulkText, setBulkText] = useState('')
  const [references, setReferences] = useState<Reference[]>([])
  const [overallStatus, setOverallStatus] = useState<ProcessingStatus>('idle')
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [currentJobs, setCurrentJobs] = useState<Map<string, StatusItem>>(
    new Map()
  )

  const [isTextareaFocused, setIsTextareaFocused] = useState(false)

  // Create a ref to track performed checks
  const performedChecksRef = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Create a ref for the verification service to persist between renders
  const verificationServiceRef = useRef<o3ReferenceVerificationService | null>(
    null
  )

  // Initialize the verification service
  useEffect(() => {
    verificationServiceRef.current = new o3ReferenceVerificationService({
      maxRetries: 3,
      requestTimeout: 60000,
      maxIterations: 15,
      batchSize: 5
    })

    return () => {
      // Clean up if needed
      verificationServiceRef.current = null
    }
  }, [])

  // Add a log message
  const addLogMessage = (message: string) => {
    setLogMessages((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`
    ])
  }

  // Update current job status
  const updateCurrentJob = (id: string, item: StatusItem) => {
    setCurrentJobs((prev) => {
      const updated = new Map(prev)
      updated.set(id, item)
      return updated
    })
  }

  // Update global job (like extraction) status
  const updateGlobalJob = (id: string, item: StatusItem) => {
    setCurrentJobs((prev) => {
      const updated = new Map(prev)
      updated.set(id, item)
      return updated
    })
  }

  const resetForm = () => {
    setBulkText('')
    setReferences([])
    setOverallStatus('idle')
    setLogMessages([])
    setCurrentJobs(new Map())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bulkText.trim()) return

    setOverallStatus('extracting')
    addLogMessage('Starting the reference verification process...')

    try {
      // Step 1: Extract references from the text using the extraction service
      updateGlobalJob('extraction', {
        pdfId: 'Text Analysis',
        status: 'processing',
        message: 'Extracting references from text...',
        timestamp: new Date()
      })

      const startTime = performance.now()

      // Create instance of the extraction service
      const extractionService = new ReferenceExtractFromTextService()

      // Track extraction progress
      // Track extraction progress
      let extractedRefs: Reference[] = []
      try {
        // Use the service with progress tracking
        extractedRefs = await extractionService.processTextWithProgress(
          bulkText,
          (processed, total) => {
            // Update extraction progress
            updateGlobalJob('extraction', {
              pdfId: 'Text Analysis',
              status: 'processing',
              message: `Extracting references (chunk ${processed}/${total})...`,
              progress: (processed / total) * 100,
              timestamp: new Date()
            })
          }
        )

        // NOW add the ID assignment AFTER extraction is complete
        // Check if any extracted references are missing IDs and assign them
        extractedRefs = extractedRefs.map((ref, index) => {
          if (!ref.id) {
            // Generate a unique ID if one doesn't exist
            const uniqueId = `ref-${Date.now()}-${index}`
            console.log(
              `Assigning ID ${uniqueId} to reference "${ref.title || 'Untitled'}"`
            )
            return { ...ref, id: uniqueId }
          }
          return ref
        })
      } catch (error) {
        addLogMessage(
          `Error extracting references: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      updateGlobalJob('extraction', {
        pdfId: 'Text Analysis',
        status: 'complete',
        message: `Found ${extractedRefs.length} references`,
        timestamp: new Date()
      })

      if (extractedRefs.length === 0) {
        addLogMessage('No references found. Please check your input.')
        setOverallStatus('complete')
        return
      }

      // Set references state with extracted references
      setReferences(extractedRefs)

      // Step 2: Start verification process using o3ReferenceVerificationService
      setOverallStatus('processing')
      addLogMessage(
        `Starting verification of ${extractedRefs.length} references using o3 batch processing...`
      )

      if (!verificationServiceRef.current) {
        throw new Error('Verification service not initialized')
      }

      // Use the processBatch method from o3ReferenceVerificationService with the new step update callback
      await verificationServiceRef.current.processBatch(
        extractedRefs,
        // On batch progress callback
        (verifiedRefs) => {
          // This is called after each batch completes
          addLogMessage(
            `Batch completed: ${verifiedRefs.length}/${extractedRefs.length} references processed`
          )
        },
        // On individual reference verified callback
        (verifiedRef) => {
          const index = extractedRefs.findIndex(
            (ref) => ref.id === verifiedRef.reference.id
          )
          if (index !== -1) {
            // Update status display
            updateCurrentJob(verifiedRef.reference.id, {
              pdfId: verifiedRef.reference.title || `Reference ${index + 1}`,
              status: verifiedRef.status === 'complete' ? 'complete' : 'error',
              message: `Reference verification ${verifiedRef.status === 'complete' ? 'complete' : 'failed'}: ${verifiedRef.reference.status}`,
              timestamp: new Date()
            })

            // Log message
            addLogMessage(
              `Completed reference ${index + 1}: ${verifiedRef.reference.status}`
            )

            // Update references state with the verified reference
            setReferences((prev) => {
              const updated = [...prev]
              updated[index] = verifiedRef.reference
              return updated
            })
          }
        },
        // New callback for step-by-step updates
        (referenceId, step, args) => {
          // Find the reference by ID
          const ref = extractedRefs.find((r) => r.id === referenceId)
          if (!ref) {
            console.warn(`Reference with ID ${referenceId} not found`)
            return
          }

          // Update the UI with the current step information for THIS specific reference
          updateCurrentJob(referenceId, {
            pdfId: ref.title || `Reference ${extractedRefs.indexOf(ref) + 1}`,
            status: 'processing',
            message: `Running ${step.replace('_', ' ')}...`,
            timestamp: new Date()
          })

          // For certain steps, we can add checks to the performed checks set
          if (step === 'check_doi') {
            performedChecksRef.current.add('DOI Lookup')
          } else if (step === 'search_reference') {
            performedChecksRef.current.add('Google Search')
          } else if (step === 'check_url') {
            performedChecksRef.current.add('URL Verification')
          }

          // Log this step for better UX
          addLogMessage(`Reference "${ref.title}": ${step.replace('_', ' ')}`)
        }
      )

      // All references processed
      setOverallStatus('complete')
      addLogMessage(
        `All ${extractedRefs.length} references have been processed.`
      )

      // Clear current jobs after a delay
      setTimeout(() => {
        setCurrentJobs(new Map())
      }, 5000)
    } catch (error) {
      console.error('Error in verification process:', error)
      setOverallStatus('error')
      addLogMessage(
        `Error in verification process: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Get total counts by status
  const statusCounts = {
    total: references.length,
    verified: references.filter((ref) => ref.status === 'verified').length,
    unverified: references.filter((ref) => ref.status === 'unverified').length,
    needsHuman: references.filter((ref) => ref.status === 'needs-human').length,
    error: references.filter((ref) => ref.status === 'error').length,
    pending: references.filter((ref) => ref.status === 'pending').length
  }

  const focusTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const isProcessingComplete =
    statusCounts.total > 0 && statusCounts.pending === 0

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Card className="w-full bg-gray-900/60 backdrop-blur-sm shadow-lg !border-0">
        <CardHeader className="pb-3"></CardHeader>
        <CardContent className="space-y-3">
          {overallStatus === 'idle' ? (
            <form onSubmit={handleSubmit}>
              {/* Styled drop zone similar to PDFDropZone */}
              <div
                className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all duration-300
                  ${isTextareaFocused ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800/50'}
                  cursor-text`}
                onClick={focusTextarea}
              >
                <div className="flex flex-col items-center gap-6">
                  {!bulkText && (
                    <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-white" />
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-lg font-medium text-white mb-1">
                      {bulkText
                        ? 'Edit reference text'
                        : 'Paste text with references here'}
                    </p>
                    <p className="text-sm text-gray-400">
                      Supports papers, bibliographies, and other reference
                      formats
                    </p>
                  </div>

                  <div className="w-full relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Paste text that contains references (e.g., a paper, bibliography, etc.)"
                      value={bulkText}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_TEXT_LENGTH) {
                          setBulkText(e.target.value)
                        }
                      }}
                      onFocus={() => setIsTextareaFocused(true)}
                      onBlur={() => setIsTextareaFocused(false)}
                      className="min-h-[180px] max-h-[400px] bg-transparent border-0 shadow-none text-gray-200 placeholder:text-gray-500 focus:ring-0 focus:outline-none resize-none"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {bulkText.length}/{MAX_TEXT_LENGTH}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!bulkText.trim()}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Extract & Verify References
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Status summary bar - using shared component */}
              <StatusSummaryBar
                status={
                  overallStatus === 'extracting'
                    ? 'extracting'
                    : overallStatus === 'processing'
                      ? 'processing'
                      : overallStatus === 'complete'
                        ? 'complete'
                        : 'error'
                }
                counts={statusCounts}
              />

              {/* References grid for visualization - Now placed ABOVE the processing info */}
              {references.length > 0 && (
                <ReferenceGrid references={references} />
              )}

              <StatusDisplay
                logMessages={logMessages}
                currentJobs={currentJobs}
              />

              <button
                onClick={resetForm}
                disabled={!isProcessingComplete && overallStatus !== 'error'}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium roun`ded-lg transition-colors"
              >
                Process New References
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
