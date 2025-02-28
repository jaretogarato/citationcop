'use client'

import type React from 'react'
import { useState, useRef } from 'react'
import { Textarea } from '@/app/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  Search,
  Link,
  FileText
} from 'lucide-react'
import { Alert, AlertTitle } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'

import { checkDOI, searchReference, checkURL } from '@/app/lib/referneceToolsCode'

type TokenUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type UIStatus =
  | 'idle'
  | 'loading'
  | 'verified'
  | 'requires-verification'
  | 'unverified'
  | 'error'

type VerificationStatus = {
  status: 'pending' | 'complete' | 'human-check-needed' | 'error'
  messages?: any[]
  iteration?: number
  functionResult?: any
  lastToolCallId?: string
  error?: string
  result?: {
    status: 'verified' | 'unverified' | 'human-check' | 'error'
    message: string
    checks_performed?: string[]
    reference: string
  }
  tokenUsage?: TokenUsage
}

type ProcessingStep =
  | 'initializing'
  | 'search_reference'
  | 'check_doi'
  | 'check_url'
  | 'finalizing'

// Badge colors for different check types (dark mode)
const checkBadgeColors: Record<string, string> = {
  'DOI Lookup': 'bg-blue-900 text-blue-200 hover:bg-blue-800 border-blue-700',
  'Google Search':
    'bg-purple-900 text-purple-200 hover:bg-purple-800 border-purple-700',
  'URL Verification':
    'bg-teal-900 text-teal-200 hover:bg-teal-800 border-teal-700',
  'Literature Search':
    'bg-indigo-900 text-indigo-200 hover:bg-indigo-800 border-indigo-700',
  'Citation Format':
    'bg-emerald-900 text-emerald-200 hover:bg-emerald-800 border-emerald-700',
  'Metadata Check':
    'bg-amber-900 text-amber-200 hover:bg-amber-800 border-amber-700'
}

export default function ReferenceVerifier() {
  const [reference, setReference] = useState('')
  const [uiStatus, setUIStatus] = useState<UIStatus>('idle')
  const [verificationState, setVerificationState] =
    useState<VerificationStatus | null>(null)
  const [processingStep, setProcessingStep] =
    useState<ProcessingStep>('initializing')
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

      // Start the actual API verification flow
      let currentState: VerificationStatus = {
        status: 'pending',
        messages: [],
        iteration: 0
      }

      setVerificationState(currentState)

      // Process steps with real API calls
      while (currentState.status === 'pending' && currentState.iteration! < 5) {
        // Call the API
        const response = await fetch('/api/o3-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference,
            iteration: currentState.iteration,
            previousMessages: currentState.messages,
            functionResult: currentState.functionResult,
            lastToolCallId: currentState.lastToolCallId
          })
        })

        const llmResponse = await response.json()

        if (llmResponse.functionToCall) {
          const { name, arguments: args } = llmResponse.functionToCall
          let functionResult

          // Update processing step based on the tool being called
          setProcessingStep(name as ProcessingStep)
          setCurrentToolArgs(args)

          switch (name) {
            case 'check_doi':
              performedChecksRef.current.add('DOI Lookup')
              functionResult = await checkDOI(args.doi, args.title)
              break
            case 'search_reference':
              performedChecksRef.current.add('Google Search')
              functionResult = await searchReference(args.reference)
              break
            case 'check_url':
              performedChecksRef.current.add('URL Verification')
              functionResult = await checkURL(args.url, args.reference)
              break
          }

          currentState = {
            ...llmResponse,
            functionResult,
            lastToolCallId: llmResponse.lastToolCallId
          }
        } else {
          // If no function is being called, we're likely finalizing
          setProcessingStep('finalizing')
          setCurrentToolArgs(null)
          currentState = llmResponse
        }

        // Update the state after each API call
        setVerificationState({ ...currentState })

        // Pause briefly to show the current step
        await new Promise((resolve) => setTimeout(resolve, 800))
      }

      // Map the status from the verification API to our UI statuses
      let finalUIStatus: UIStatus = 'idle'

      if (currentState.result) {
        switch (currentState.result.status) {
          case 'verified':
            finalUIStatus = 'verified'
            break
          case 'human-check':
            finalUIStatus = 'requires-verification'
            break
          case 'unverified':
            finalUIStatus = 'unverified'
            break
          case 'error':
            finalUIStatus = 'error'
            break
        }

        // Get checks performed
        const checksPerformed = getChecksPerformed(
          currentState,
          performedChecksRef.current
        )

        setResult({
          formattedReference: currentState.result.reference || reference,
          explanation: currentState.result.message || 'Verification completed.',
          wasModified: currentState.result.reference !== reference,
          checksPerformed,
          tokenUsage: currentState.tokenUsage
        })

        setUIStatus(finalUIStatus)
      } else if (currentState.error) {
        setResult({
          formattedReference: reference,
          explanation:
            currentState.error || 'An error occurred during verification.',
          wasModified: false,
          checksPerformed: getChecksPerformed(
            currentState,
            performedChecksRef.current
          )
        })
        setUIStatus('error')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setResult({
        formattedReference: reference,
        explanation:
          'An error occurred while connecting to the verification service. Please try again later.',
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

  // Function to get checks performed
  function getChecksPerformed(currentState: any, performedChecks: Set<string>) {
    if (
      currentState?.result?.checks_performed &&
      currentState.result.checks_performed.length > 0
    ) {
      return currentState.result.checks_performed
    }

    // Fallback to our tracked checks
    if (performedChecks.size > 0) {
      return Array.from(performedChecks)
    }

    // Last resort: try to extract from message history
    const checks = new Set<string>()

    currentState?.messages?.forEach((msg: any) => {
      if (msg.role === 'assistant' && msg.tool_calls) {
        msg.tool_calls.forEach((call: any) => {
          if (call.function?.name === 'check_doi') {
            checks.add('DOI Lookup')
          } else if (call.function?.name === 'search_reference') {
            checks.add('Literature Search')
          } else if (call.function?.name === 'check_url') {
            checks.add('URL Verification')
          }
        })
      }
    })

    return Array.from(checks)
  }

  // Helper function to render processing step with appropriate icon and description
  const renderProcessingStep = () => {
    switch (processingStep) {
      case 'initializing':
        return (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-400" />
            <span>analyzing reference structure</span>
          </div>
        )
      case 'search_reference':
        return (
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-400" />
            <span>
              searching:{' '}
              {currentToolArgs?.reference
                ? `"${currentToolArgs.reference.substring(0, 30)}${currentToolArgs.reference.length > 30 ? '...' : ''}"`
                : 'reference'}
            </span>
          </div>
        )
      case 'check_doi':
        return (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-400" />
            <span>
              checking DOI:{' '}
              {currentToolArgs?.doi ? currentToolArgs.doi : 'identifier'}
            </span>
          </div>
        )
      case 'check_url':
        return (
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-indigo-400" />
            <span>
              verifying URL:{' '}
              {currentToolArgs?.url
                ? currentToolArgs.url.substring(0, 30) +
                  (currentToolArgs.url.length > 30 ? '...' : '')
                : 'link'}
            </span>
          </div>
        )
      case 'finalizing':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>finalizing verification</span>
          </div>
        )
      default:
        return <span>processing...</span>
    }
  }

  const resetForm = () => {
    setReference('')
    setUIStatus('idle')
    setVerificationState(null)
    setResult(null)
    setCurrentToolArgs(null)
  }

  // Helper function to get badge color for a check type
  const getBadgeColor = (checkType: string) => {
    return (
      checkBadgeColors[checkType] ||
      'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-600'
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="w-full bg-gray-900/60 backdrop-blur-sm shadow-lg !border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-white">
            Try Our Reference Verifier
          </CardTitle>
          <CardDescription className="text-gray-300">
            Paste a single reference to verify its accuracy and format
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

              {/* Updated Verify Reference button */}
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
                  {renderProcessingStep()}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert
                variant={
                  uiStatus === 'verified'
                    ? 'default'
                    : uiStatus === 'requires-verification'
                      ? 'default'
                      : 'destructive'
                }
                className={`p-2.5 border ${
                  uiStatus === 'verified'
                    ? 'border-green-700 bg-green-900/30 text-green-200'
                    : uiStatus === 'requires-verification'
                      ? 'border-yellow-700 bg-yellow-900/30 text-yellow-200'
                      : 'border-red-700 bg-red-900/30 text-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {uiStatus === 'verified' && (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  )}
                  {uiStatus === 'requires-verification' && (
                    <Clock className="h-5 w-5 text-yellow-400" />
                  )}
                  {(uiStatus === 'unverified' || uiStatus === 'error') && (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  )}

                  <AlertTitle className="text-sm">
                    {uiStatus === 'verified' && 'Reference Verified'}
                    {uiStatus === 'requires-verification' &&
                      'Requires Human Verification'}
                    {uiStatus === 'unverified' && 'Reference Unverified'}
                    {uiStatus === 'error' && 'Error Processing Reference'}
                  </AlertTitle>
                </div>
              </Alert>

              <div className="space-y-2">
                <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5 relative">
                  {/* Reformatted badge in upper right corner */}
                  {result?.wasModified && (
                    <Badge className="absolute top-2 right-2 bg-blue-900 text-blue-200 text-xs border-blue-700">
                      reformatted
                    </Badge>
                  )}
                  <p className="text-sm text-left text-gray-200 pr-20">
                    {result?.formattedReference}
                  </p>
                </div>

                <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5">
                  <p className="text-sm leading-relaxed text-gray-300 text-left mb-3">
                    {result?.explanation}
                  </p>

                  {/* Display checks performed below the explanation */}
                  {result?.checksPerformed &&
                    result.checksPerformed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {result.checksPerformed.map((check, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className={`text-xs ${getBadgeColor(check)}`}
                          >
                            {check}
                          </Badge>
                        ))}
                      </div>
                    )}
                </div>

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
              </div>

              {/* Updated "Verify Another Reference" button */}
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