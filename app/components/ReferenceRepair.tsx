'use client'

import React, { useState } from 'react'
import { Textarea } from '@/app/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'

type UIStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ReferenceRepair() {
  const [reference, setReference] = useState('')
  const [uiStatus, setUIStatus] = useState<UIStatus>('idle')
  const [result, setResult] = useState<{
    status: string
    organic: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reference.trim()) return

    setUIStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/references/verify-openai-repair/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'An error occurred while repairing the reference'
        )
      }

      setResult(data)
      setUIStatus('success')
    } catch (err) {
      console.error('Reference repair error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred while connecting to the repair service'
      )
      setUIStatus('error')
    }
  }

  const resetForm = () => {
    setReference('')
    setUIStatus('idle')
    setResult(null)
    setError(null)
  }

  // Function to format the organic result with better readability
  const formatOrganicResult = (organic: string) => {
    // Split by numbered points (1., 2., 3.)
    const sections = organic
      .split(/(?:\r?\n\s*\d+\.\s*|\r?\n\s*-\s*)/g)
      .filter((section) => section.trim().length > 0)

    if (sections.length <= 1) {
      // If no clear sections, return as is with line breaks
      return organic.split('\n').map((line, i) => (
        <p key={i} className="mb-2">
          {line}
        </p>
      ))
    }

    return sections.map((section, i) => (
      <div key={i} className="mb-3">
        <p className="mb-1 font-medium">
          {i === 0
            ? 'Source Check:'
            : i === 1
              ? 'Search Sources:'
              : 'Repaired Reference:'}
        </p>
        <p className="text-gray-300">{section.trim()}</p>
      </div>
    ))
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="w-full bg-gray-900/60 backdrop-blur-sm shadow-lg !border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-white">Reference Repair</CardTitle>
          <CardDescription className="text-gray-300">
            Paste a reference to fill out any missing information or fix errors
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
                Repair Reference
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
                  Repairing reference...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Status Alert */}
              <div
                className={`rounded-md p-3 ${uiStatus === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {uiStatus === 'success' ? (
                      <svg
                        className="h-5 w-5 text-green-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3
                      className={`text-sm font-medium ${uiStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {uiStatus === 'success'
                        ? 'Reference Processed'
                        : 'Error Processing Reference'}
                    </h3>
                    <div className="mt-2 text-sm text-gray-300">
                      {uiStatus === 'success'
                        ? 'Reference has been .'
                        : error || 'An unexpected error occurred.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Display */}
              {result && result.organic && (
                <div className="rounded-md border border-gray-700 bg-gray-800/30 p-4 mt-4">
                  <h3 className="text-lg font-medium text-white mb-3">
                    Reference Repair Results
                  </h3>
                  <div className="space-y-2 text-sm text-gray-200">
                    {formatOrganicResult(result.organic)}
                  </div>
                </div>
              )}

              <button
                onClick={resetForm}
                className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Repair Another Reference
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
