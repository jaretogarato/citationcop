'use client'

import { useState } from 'react'

import type { Reference } from '@/app/types/reference'
import ReferenceGrid from '@/app/components/batch/ReferenceGrid'

interface PageResult {
  pageNumber: number
  markdown: string
  hasReferences: boolean
}

export default function TestReferences() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [results, setResults] = useState<PageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [references, setReferences] = useState<Reference[]>([])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
    setResults([])
    setError(null)
    setProgress('')
    setReferences([])
  }

  const handleProcessPdf = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file.')
      return
    }

    setLoading(true)
    setError(null)
    setProgress('Converting PDF to images...')

    try {
      // Step 1: Convert PDF to images
      const formData = new FormData()
      formData.append('pdf', selectedFile)
      formData.append('range', '1-100')

      const pdfResponse = await fetch('/api/pdf2images', {
        method: 'POST',
        body: formData
      })

      if (!pdfResponse.ok) {
        throw new Error('Failed to convert PDF to images')
      }

      const { images } = await pdfResponse.json()
      setImages(images)
      setProgress(`Analyzing ${images.length} pages for references...`)

      // Step 2: Check each page for references
      const pageResults = await Promise.all(
        images.map(async (base64Image: string, index: number) => {
          const imageData = `data:image/jpeg;base64,${base64Image}`

          const checkResponse = await fetch(
            '/api/llama-vision/yes-references',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filePath: imageData,
                model: 'Llama-3.2-90B-Vision'
              })
            }
          )

          if (!checkResponse.ok) {
            throw new Error('Failed to check for references')
          }

          const { hasReferences } = await checkResponse.json()

          let markdown = ''
          if (hasReferences) {
            setProgress(
              `Found references on page ${index + 1}, extracting content...`
            )
            const markdownResponse = await fetch('/api/llama-vision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filePath: imageData,
                model: 'Llama-3.2-90B-Vision'
              })
            })

            if (markdownResponse.ok) {
              const { markdown: pageMarkdown } = await markdownResponse.json()
              markdown = pageMarkdown
            }
          }

          return {
            pageNumber: index + 1,
            hasReferences,
            markdown
          }
        })
      )

      setResults(pageResults)

      // Step 3: Extract structured references
      const referencePagesMarkdown = pageResults
        .filter((r) => r.hasReferences)
        .map((r) => r.markdown)
        .join('\n\n')

      if (referencePagesMarkdown) {
        setProgress('Extracting structured references...')
        const extractResponse = await fetch('/api/references/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: referencePagesMarkdown })
        })

        if (!extractResponse.ok) {
          throw new Error('Failed to extract structured references')
        }

        const { references } = await extractResponse.json()
        setReferences(references)
      }

      setProgress('')
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Academic Paper Reference Extractor
      </h1>

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
            ${!selectedFile || loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Processing...' : 'Extract References'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {progress && (
        <div className="bg-blue-50 text-blue-700 p-4 rounded-md mb-4">
          {progress}
        </div>
      )}
      {references.length > 0 && (
        <div className="space-y-4">
          <ReferenceGrid references={references} />
        </div>
      )}

      {results
        .filter((r) => r.hasReferences)
        .map((result) => (
          <div key={result.pageNumber} className="mb-8">
            <h2 className="text-xl font-semibold mb-2">
              References found on page {result.pageNumber}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-md p-4">
                <h3 className="text-lg font-medium mb-2">Original Page</h3>
                <img
                  src={`data:image/jpeg;base64,${images[result.pageNumber - 1]}`}
                  alt={`Page ${result.pageNumber}`}
                  className="w-full h-auto"
                />
              </div>

              <div className="border rounded-md p-4">
                <h3 className="text-lg font-medium mb-2">
                  Extracted References
                </h3>
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {result.markdown}
                </pre>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}
