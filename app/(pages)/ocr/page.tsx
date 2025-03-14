'use client'

import { useState } from 'react'

export default function DocumentUnderstandingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [references, setReferences] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setReferences(null)
      setError(null)
    }
  }

  const extractReferences = async () => {
    if (!file) {
      setError('Please select a PDF file first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ocr/extract-references', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error processing the document')
      }

      const data = await response.json()
      setReferences(data.references)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">PDF Reference Extractor</h1>

      <div className="mb-6 p-6 border border-gray-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Upload Academic Paper</h2>
        <div className="mb-4">
          <label className="block mb-2">Select a PDF file:</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-gray-500 file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0 file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Selected file: <span className="font-medium">{file.name}</span> (
              {(file.size / 1024).toFixed(2)} KB)
            </p>
          </div>
        )}

        <button
          onClick={extractReferences}
          disabled={!file || loading}
          className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Extracting References...' : 'Extract References'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <p>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {references && (
        <div className="mb-6 p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Extracted References</h2>
          <div className="bg-gray-700 p-4 rounded-md whitespace-pre-wrap">
            {references}
          </div>
        </div>
      )}
    </div>
  )
}
