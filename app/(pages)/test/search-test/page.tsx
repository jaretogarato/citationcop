'use client'

import { useState } from 'react'
import Input from '@/app/components/ui/Input'

export default function SearchTestPage() {
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [citations, setCitations] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setResult(null)
    setCitations([])
    setError(null)

    try {
      const res = await fetch('/api/references/openAI-websearch/responses-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference })
      })

      const data = await res.json()

      if (res.ok && data.status === 'success') {
        setResult(data.output_text)
        setCitations(data.citations || [])
      } else {
        setError(data.error || 'Unknown error')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Reference Search</h1>
      <Input
        onChange={(value) => setReference(value)}
        type="reference"
        placeholder="reference"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !reference}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>

      {error && <p className="text-red-500 mt-4">Error: {error}</p>}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Output</h2>
          <p className="mt-2 whitespace-pre-wrap">{result}</p>

          {citations.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium">Citations</h3>
              <ul className="list-disc ml-6">
                {citations.map((c, idx) => (
                  <li key={idx}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {c.title || c.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
