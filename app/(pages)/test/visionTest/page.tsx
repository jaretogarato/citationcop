'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

export default function Page() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [markdownResults, setMarkdownResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
    setMarkdownResults([])
    setError(null)
  }

  const handleProcessPdf = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Step 1: Convert PDF to images
      const formData = new FormData()
      formData.append('pdf', selectedFile)
      formData.append('range', '1-10') // Adjust range as needed

      const pdfResponse = await fetch('/api/pdf2images', {
        method: 'POST',
        body: formData
      })

      if (!pdfResponse.ok) {
        throw new Error('Failed to convert PDF to images')
      }

      const { images } = await pdfResponse.json()

      // Step 2: Process each image through OCR
      const markdownPromises = images.map(async (base64Image: string) => {
        const ocrResponse = await fetch('/api/llama-vision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath: `data:image/jpeg;base64,${base64Image}`,
            model: 'Llama-3.2-90B-Vision'
          })
        })

        if (!ocrResponse.ok) {
          const errorData = await ocrResponse.json()
          throw new Error(
            errorData.error || 'Failed to process image through OCR'
          )
        }

        const { markdown } = await ocrResponse.json()
        return markdown
      })

      const results = await Promise.all(markdownPromises)
      setMarkdownResults(results.filter(Boolean))
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PDF to Markdown Converter</h1>

      <div className="mb-4">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="mb-2 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />

        <button
          onClick={handleProcessPdf}
          disabled={!selectedFile || loading}
          className={`px-4 py-2 rounded-md text-white 
            ${
              !selectedFile || loading
                ? 'bg-gray-400'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {loading ? 'Processing...' : 'Convert PDF'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {markdownResults.map((markdown, index) => (
        <div key={index} className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Page {index + 1}</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Raw Markdown */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-2">Raw Markdown</h3>
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {markdown}
              </pre>
            </div>

            {/* Rendered Markdown */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-2">Rendered Preview</h3>
              <div className="prose max-w-none">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
