//app/components/verify-reference/MultiReferenceVerifier.tsx
'use client'

import React, { useState, useRef } from 'react'
import { Textarea } from '@/app/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { StatusSummaryBar } from '@/app/components/verify-reference/StatusSummaryBar'
import StatusDisplay from '@/app/components/batch/StatusDisplay'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'
import {
  verifyReference,
  extractReferences
} from '@/app/lib/verification-service'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
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

export default function MultiReferenceVerifier() {
  const [bulkText, setBulkText] = useState('')
  const [references, setReferences] = useState<Reference[]>([])
  const [overallStatus, setOverallStatus] = useState<ProcessingStatus>('idle')
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [currentJobs, setCurrentJobs] = useState<Map<string, StatusItem>>(
    new Map()
  )
  const [extractionTime, setExtractionTime] = useState<number | null>(null)
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)

  // Create a ref to track performed checks
  const performedChecksRef = useRef<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Process references in batches of specified size
  const processBatch = async (
    refs: Reference[],
    startIndex: number,
    batchSize: number
  ) => {
    const endIndex = Math.min(startIndex + batchSize, refs.length)
    const batch = refs.slice(startIndex, endIndex)

    // Array to collect promises
    const promises = batch.map(async (ref, batchIdx) => {
      const currentIdx = startIndex + batchIdx

      try {
        // Update current jobs
        updateCurrentJob(ref.id, {
          pdfId: ref.title,
          status: 'processing',
          message: `Verifying reference ${currentIdx + 1} of ${refs.length}`,
          timestamp: new Date()
        })

        addLogMessage(`Verifying reference ${currentIdx + 1}: "${ref.title}"`)

        // Process the reference using our shared verification service
        const verifiedRef = await verifyReference(
          ref,
          (step, args) => {
            updateCurrentJob(ref.id, {
              pdfId: ref.title,
              status: 'processing',
              message: `Running ${step.replace('_', ' ')}...`,
              timestamp: new Date()
            })
          },
          new Set<string>() // Use a separate set for each reference to avoid interference
        )

        // Update job status
        updateCurrentJob(ref.id, {
          pdfId: ref.title,
          status: 'complete',
          message: `Reference verification complete: ${verifiedRef.status}`,
          timestamp: new Date()
        })

        addLogMessage(
          `Completed reference ${currentIdx + 1}: ${verifiedRef.status}`
        )

        // Force real-time update of this reference in the state
        setReferences((prev) => {
          const updated = [...prev]
          updated[currentIdx] = verifiedRef
          return updated
        })

        return { index: currentIdx, reference: verifiedRef }
      } catch (error) {
        console.error(`Error processing reference ${currentIdx + 1}:`, error)

        // Update job status
        updateCurrentJob(ref.id, {
          pdfId: ref.title,
          status: 'error',
          message: `Error verifying reference ${currentIdx + 1}`,
          timestamp: new Date()
        })

        addLogMessage(
          `Error processing reference ${currentIdx + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )

        // Update this reference with error status immediately
        const errorRef = {
          ...ref,
          status: 'error' as ReferenceStatus,
          message: 'An error occurred during verification.'
        }

        setReferences((prev) => {
          const updated = [...prev]
          updated[currentIdx] = errorRef
          return updated
        })

        return {
          index: currentIdx,
          reference: errorRef
        }
      }
    })

    // Wait for all promises in the batch to resolve
    const results = await Promise.all(promises)

    // If there are more references to process, continue with the next batch
    if (endIndex < refs.length) {
      await processBatch(refs, endIndex, batchSize)
    }
  }

  const resetForm = () => {
    setBulkText('')
    setReferences([])
    setOverallStatus('idle')
    setLogMessages([])
    setCurrentJobs(new Map())
    setExtractionTime(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bulkText.trim()) return

    setOverallStatus('extracting')
    addLogMessage('Starting the reference verification process...')

    try {
      // Step 1: Extract references from the text
      updateGlobalJob('extraction', {
        pdfId: 'Text Analysis',
        status: 'processing',
        message: 'Extracting references from text...',
        timestamp: new Date()
      })

      const startTime = performance.now()

      let extractedRefs: Reference[] = []
      try {
        extractedRefs = await extractReferences(bulkText)
        const endTime = performance.now()
        const extractionTimeMs = endTime - startTime
        setExtractionTime(extractionTimeMs)
        addLogMessage(
          `Found ${extractedRefs.length} references in ${(extractionTimeMs / 1000).toFixed(2)}s`
        )
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

      // Start verification process
      setOverallStatus('processing')
      addLogMessage(
        `Starting verification of ${extractedRefs.length} references in batches of 5...`
      )

      // Process references in batches of 5
      await processBatch(extractedRefs, 0, 5)

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

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Card className="w-full bg-gray-900/60 backdrop-blur-sm shadow-lg !border-0">
        <CardHeader className="pb-3">
          {/*<CardTitle className="text-white">Bulk Reference Verifier</CardTitle>
          <CardDescription className="text-gray-300">
            {overallStatus === 'idle'
              ? 'Paste text containing references to extract and verify them all at once'
              : `${references.length} references found - verifying ${statusCounts.verified + statusCounts.unverified + statusCounts.needsHuman + statusCounts.error}/${references.length}`}
          </CardDescription>*/}
        </CardHeader>
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
                        if (e.target.value.length <= 1500) {
                          setBulkText(e.target.value)
                        }
                      }}
                      onFocus={() => setIsTextareaFocused(true)}
                      onBlur={() => setIsTextareaFocused(false)}
                      className="min-h-[180px] max-h-[400px] bg-transparent border-0 shadow-none text-gray-200 placeholder:text-gray-500 focus:ring-0 focus:outline-none resize-none"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {bulkText.length}/1500
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

              {/* Processing status display - Using your existing StatusDisplay component */}
              <StatusDisplay
                logMessages={logMessages}
                currentJobs={currentJobs}
              />

              <button
                onClick={resetForm}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
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
