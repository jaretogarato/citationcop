// app/test/page.tsx
'use client'

import { useState } from 'react'
import { ReferenceStatus } from '@/app/types/reference'
type VerificationStatus = {
  status: ReferenceStatus
  messages?: any[]
  iteration?: number
  result?: any
  error?: string
  functionResult?: string
  lastToolCallId?: string
}

export default function ReferenceTest() {
  const [reference, setReference] = useState('')
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null)
  const [loading, setLoading] = useState(false)

  // Modify the verifyReference function:
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
            functionResult: currentState.functionResult, // Add these new fields
            lastToolCallId: currentState.lastToolCallId
          })
        })

        const llmResponse = await response.json()

        // If we get a function to call
        if (llmResponse.functionToCall) {
          const { name, arguments: args } = llmResponse.functionToCall
          let functionResult

          switch (name) {
            case 'check_doi':
              functionResult = await checkDOI(args.doi, args.title)
              break
            case 'google_search':
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Reference Verification Test
      </h1>

      <div className="mb-4">
        <label className="block mb-2 text-gray-800">Enter Reference:</label>
        <textarea
          className="w-full p-2 border rounded text-gray-800"
          rows={4}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Paste your reference here..."
        />
      </div>

      <button
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        onClick={verifyReference}
        disabled={loading || !reference}
      >
        {loading ? 'Verifying...' : 'Verify Reference'}
      </button>

      {verificationStatus && (
        <div className="mt-4 space-y-4">
          <div className="p-4 border rounded bg-white">
            <h2 className="font-bold mb-2 text-gray-800">
              Status: {verificationStatus.status}
            </h2>
            {verificationStatus.iteration !== undefined && (
              <p className="text-gray-700">
                Iteration: {verificationStatus.iteration}
              </p>
            )}
            {verificationStatus.error && (
              <p className="text-red-500">{verificationStatus.error}</p>
            )}
            {verificationStatus.result && (
              <div className="mt-2">
                <h3 className="font-bold text-gray-800">Result:</h3>
                <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-gray-700">
                  {JSON.stringify(verificationStatus.result, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {verificationStatus.messages &&
            verificationStatus.messages.length > 0 && (
              <div className="p-4 border rounded bg-white">
                <h2 className="font-bold mb-2 text-gray-800">
                  Verification Steps:
                </h2>
                {verificationStatus.messages.map((msg, index) => (
                  <div key={index} className="mb-2 p-2 rounded bg-gray-50">
                    <strong className="text-gray-800">{msg.role}:</strong>
                    <pre className="whitespace-pre-wrap text-gray-700">
                      {typeof msg.content === 'string'
                        ? msg.content
                        : JSON.stringify(msg.content, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  )
}
