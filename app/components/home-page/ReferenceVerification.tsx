import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/app/components/ui/accordion'
import Button from '@/app/components/ui/Button'
import { Textarea } from '@/app/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'

type TokenUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

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
    checks_performed: string[]
    reference: string
  }
  tokenUsage?: TokenUsage
}

export default function ReferenceVerification() {
  const [reference, setReference] = useState('')
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const verifyReference = async () => {
    setLoading(true)
    try {
      let currentState: VerificationStatus = {
        status: 'pending',
        messages: [],
        iteration: 0
      }

      setVerificationStatus(currentState)

      while (currentState.status === 'pending' && currentState.iteration! < 5) {
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

          switch (name) {
            case 'check_doi':
              functionResult = await checkDOI(args.doi, args.title)
              break
            case 'search_reference':
              functionResult = await searchReference(args.reference)
              break
            case 'check_url':
              functionResult = await checkURL(args.url, args.reference)
              break
          }

          currentState = {
            ...llmResponse,
            functionResult,
            lastToolCallId: llmResponse.lastToolCallId
          }
        } else {
          currentState = llmResponse
        }

        setVerificationStatus(currentState)
      }
    } catch (error) {
      console.error('Error:', error)
      setVerificationStatus({
        status: 'error',
        error: 'Failed to verify reference'
      })
    }
    setLoading(false)
  }

  async function checkDOI(doi: string, title: string) {
    const response = await fetch('/api/references/verify-doi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ references: [{ DOI: doi, title }] })
    })
    return await response.json()
  }

  async function searchReference(reference: string) {
    const response = await fetch('/api/references/verify-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })
    return await response.json()
  }

  async function checkURL(url: string, reference: string) {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    return await response.json()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-gradient-to-r from-green-400 to-emerald-400'
      case 'error':
        return 'bg-gradient-to-r from-red-400 to-rose-400'
      default:
        return 'bg-gradient-to-r from-indigo-400 to-purple-400'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <Card className="bg-white/5 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 inline-block text-transparent bg-clip-text">
            Reference Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Textarea
              className="w-full p-4 bg-gray-900/50 border-gray-700 text-gray-100 rounded-xl"
              rows={4}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Paste your reference here..."
            />
          </div>

          <Button
            className={`relative px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transform transition-all duration-200 
              ${
                loading
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
              }`}
            onClick={verifyReference}
            disabled={loading || !reference}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify Reference'
            )}
          </Button>

          {verificationStatus && (
            <div className="mt-6 space-y-4">
              <Card className="border-gray-800 bg-gray-900/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-bold text-gray-100">Status:</h2>
                    <Badge
                      className={`${getStatusColor(verificationStatus.status)}`}
                    >
                      {verificationStatus.status}
                    </Badge>
                  </div>

                  {verificationStatus.iteration !== undefined && (
                    <p className="text-gray-300">
                      Iteration: {verificationStatus.iteration}
                    </p>
                  )}

                  {verificationStatus.error && (
                    <p className="text-red-400 mt-2">
                      {verificationStatus.error}
                    </p>
                  )}

                  <Accordion type="single" collapsible className="w-full">
                    {verificationStatus.result && (
                      <AccordionItem value="result">
                        <AccordionTrigger className="text-gray-100">
                          View Verification Results
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`${
                                  verificationStatus.result.status ===
                                  'verified'
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                                    : verificationStatus.result.status ===
                                        'unverified'
                                      ? 'bg-gradient-to-r from-red-400 to-rose-400'
                                      : 'bg-gradient-to-r from-yellow-400 to-amber-400'
                                }`}
                              >
                                {verificationStatus.result.status.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl">
                              <h3 className="text-gray-200 font-semibold mb-2">
                                Message
                              </h3>
                              <p className="text-gray-300">
                                {verificationStatus.result.message}
                              </p>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl">
                              <h3 className="text-gray-200 font-semibold mb-2">
                                Checks Performed
                              </h3>
                              <ul className="list-disc list-inside text-gray-300">
                                {verificationStatus.result.checks_performed.map(
                                  (check: string, index: number) => (
                                    <li key={index}>{check}</li>
                                  )
                                )}
                              </ul>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl">
                              <h3 className="text-gray-200 font-semibold mb-2">
                                Formatted Reference
                              </h3>
                              <p className="text-gray-300 font-mono text-sm">
                                {verificationStatus.result.reference}
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {verificationStatus.tokenUsage && (
                      <AccordionItem value="usage">
                        <AccordionTrigger className="text-gray-100">
                          View Token Usage
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-gray-800/50 p-4 rounded-xl space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-300">
                                    Prompt Tokens:
                                  </span>
                                  <span className="text-gray-200 font-mono">
                                    {
                                      verificationStatus.tokenUsage
                                        .prompt_tokens
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">
                                    Cost ($1.10/M):
                                  </span>
                                  <span className="text-gray-300 font-mono">
                                    $
                                    {(
                                      (verificationStatus.tokenUsage
                                        .prompt_tokens /
                                        1000000) *
                                      1.1
                                    ).toFixed(6)}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-300">
                                    Completion Tokens:
                                  </span>
                                  <span className="text-gray-200 font-mono">
                                    {
                                      verificationStatus.tokenUsage
                                        .completion_tokens
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">
                                    Cost ($4.40/M):
                                  </span>
                                  <span className="text-gray-300 font-mono">
                                    $
                                    {(
                                      (verificationStatus.tokenUsage
                                        .completion_tokens /
                                        1000000) *
                                      4.4
                                    ).toFixed(6)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-gray-700 pt-2 mt-4">
                              <div className="flex justify-between">
                                <span className="text-gray-300">
                                  Total Tokens:
                                </span>
                                <span className="text-gray-200 font-mono">
                                  {verificationStatus.tokenUsage.total_tokens}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">
                                  Total Cost:
                                </span>
                                <span className="text-gray-300 font-mono">
                                  $
                                  {(
                                    (verificationStatus.tokenUsage
                                      .prompt_tokens /
                                      1000000) *
                                      1.1 +
                                    (verificationStatus.tokenUsage
                                      .completion_tokens /
                                      1000000) *
                                      4.4
                                  ).toFixed(6)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {verificationStatus.messages &&
                      verificationStatus.messages.length > 0 && (
                        <AccordionItem value="steps">
                          <AccordionTrigger className="text-gray-100">
                            View Verification Steps
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              {verificationStatus.messages.map((msg, index) => (
                                <div
                                  key={index}
                                  className="p-4 rounded-xl bg-gray-800/50"
                                >
                                  <strong className="text-gray-300">
                                    {msg.role}:
                                  </strong>
                                  <pre className="mt-2 whitespace-pre-wrap text-gray-400 text-sm">
                                    {typeof msg.content === 'string'
                                      ? msg.content
                                      : JSON.stringify(msg.content, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
