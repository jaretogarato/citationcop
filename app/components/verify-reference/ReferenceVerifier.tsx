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
import {
  ProcessingStepDisplay,
  VerificationAlert,
  ReferenceResult,
  UIStatus
} from '@/app/components/verify-reference/VerificationStatusComponent'
import { 
  verifyReference, 
  ProcessingStep, 
  VerificationStatus,
  TokenUsage
} from '@/app/lib/verification-service'
import type { Reference } from '@/app/types/reference'

export default function ReferenceVerifier() {
  const [reference, setReference] = useState('')
  const [uiStatus, setUIStatus] = useState<UIStatus>('idle')
  const [verificationState, setVerificationState] = useState<VerificationStatus | null>(null)
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('initializing')
  const [currentToolArgs, setCurrentToolArgs] = useState<any>(null)
  const [result, setResult] = useState<{
    formattedReference: string
    explanation: string
    wasModified: boolean
    checksPerformed: string[]
    tokenUsage?: TokenUsage
  } | null>(null)

  // Flag to control token usage display - set to false by default
  const showTokenUsage = false

  // Create a ref to track performed checks
  const performedChecksRef = useRef<Set<string>>(new Set())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reference.trim()) return

    setUIStatus('loading')
    // Reset the checks tracker
    performedChecksRef.current.clear()
    setCurrentToolArgs(null)

    try {
      // Initialize with first processing step
      setProcessingStep('initializing')
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Create a temporary reference object
      const referenceObj: Reference = {
        id: `ref-${Date.now()}`,
        title: reference.substring(0, 30) + (reference.length > 30 ? '...' : ''),
        authors: [],
        raw: reference,
        status: 'pending',
        sourceDocument: 'Manual Input',
        date_of_access: undefined
      }

      // Process the reference using the reusable verification service
      const verifiedRef = await verifyReference(
        referenceObj,
        (step, args) => {
          setProcessingStep(step)
          setCurrentToolArgs(args)
        },
        performedChecksRef.current
      )

      // Map the status from the verification API to our UI statuses
      let finalUIStatus: UIStatus = 'idle'

      switch (verifiedRef.status) {
        case 'verified':
          finalUIStatus = 'verified'
          break
        case 'needs-human':
          finalUIStatus = 'requires-verification'
          break
        case 'unverified':
          finalUIStatus = 'unverified'
          break
        case 'error':
          finalUIStatus = 'error'
          break
      }

      setResult({
        formattedReference: verifiedRef.fixedReference || reference,
        explanation: verifiedRef.message || 'Verification completed.',
        wasModified: !!verifiedRef.fixedReference,
        checksPerformed: verifiedRef.checksPerformed || [],
      })

      setUIStatus(finalUIStatus)
    } catch (error) {
      console.error('Verification error:', error)
      setResult({
        formattedReference: reference,
        explanation:
          error instanceof Error 
            ? error.message 
            : 'An error occurred while connecting to the verification service. Please try again later.',
        wasModified: false,
        checksPerformed: Array.from(performedChecksRef.current)
      })
      setUIStatus('error')
      setVerificationState({
        status: 'error',
        error: 'Failed to verify reference'
      })
    }
  }

  const resetForm = () => {
    setReference('')
    setUIStatus('idle')
    setVerificationState(null)
    setResult(null)
    setCurrentToolArgs(null)
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="w-full bg-gray-900/60 backdrop-blur-sm shadow-lg !border-0">
        <CardHeader className="pb-3">
            <CardTitle className="text-white">
            Try Source Verify 👇  
            </CardTitle>
          <CardDescription className="text-gray-300">
            Paste a single reference to verify and repair
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {uiStatus === 'idle' ? (
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <Textarea
                  placeholder="Paste your reference here (e.g., Smith, J., The Example Book, 2020)"
                  value={reference}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setReference(e.target.value)
                    }
                  }}
                  className="min-h-[80px] max-h-[160px] bg-gray-800/80 border-gray-700 text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {reference.length}/500
                </div>
              </div>

              <button
                type="submit"
                disabled={!reference.trim()}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Verify Reference
              </button>
            </form>
          ) : uiStatus === 'loading' ? (
            <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5">
              <div className="flex items-center gap-3">
                <div className="relative flex-none">
                  <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></div>
                  <div className="relative h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                </div>
                <p className="text-sm font-medium text-gray-200">
                  Verifying reference...
                </p>
                <div className="text-sm text-gray-400 ml-auto">
                  <ProcessingStepDisplay 
                    processingStep={processingStep}
                    currentToolArgs={currentToolArgs}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <VerificationAlert status={uiStatus} />

              {result && (
                <ReferenceResult 
                  formattedReference={result.formattedReference}
                  explanation={result.explanation}
                  wasModified={result.wasModified}
                  checksPerformed={result.checksPerformed}
                />
              )}

              {/* Display token usage if showTokenUsage is true */}
              {showTokenUsage && result?.tokenUsage && (
                <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5 text-xs text-gray-400">
                  <p>Token Usage:</p>
                  <div className="flex justify-between mt-1">
                    <span>Prompt: {result.tokenUsage.prompt_tokens}</span>
                    <span>
                      Completion: {result.tokenUsage.completion_tokens}
                    </span>
                    <span>Total: {result.tokenUsage.total_tokens}</span>
                  </div>
                </div>
              )}

              <button
                onClick={resetForm}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Verify Another Reference
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}