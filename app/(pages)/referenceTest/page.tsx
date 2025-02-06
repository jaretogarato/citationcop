'use client'

import { useState, useEffect } from 'react'
import type { Reference } from '@/app/types/reference'
import ReferenceGrid from '@/app/components/reference-display/ReferenceGrid'

interface PageResult {
  pageNumber: number
  markdown: string
  isStartOfSection?: boolean
  isNewSectionStart?: boolean
}

export default function TestReferences() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [results, setResults] = useState<PageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [references, setReferences] = useState<Reference[]>([])
  let referencesSectionEnd: number | null = null

  const [pageAnalyses, setPageAnalyses] = useState<
    {
      pageNumber: number
      isReferencesStart: boolean
      isNewSectionStart: boolean
      containsReferences: boolean
    }[]
  >([])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
    setResults([])
    setError(null)
    setProgress('')
    setReferences([])
  }

  const analyzePage = async (
    imageData: string
  ): Promise<{
    isReferencesStart: boolean
    isNewSectionStart: boolean
    containsReferences: boolean
  }> => {
    const response = await fetch('/api/llama-vision/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: imageData,
        mode: 'free'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze page')
    }

    return response.json()
  }

  const handleProcessPdf = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file.')
      return
    }

    setLoading(true)
    setError(null)
    setProgress('Converting PDF to images...')
    setResults([])
    setPageAnalyses([]) // Clear previous analyses

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
      setProgress('Searching for references section from the end...')

      // Step 2: Find the references section boundaries and analyze pages
      let referencesSectionStart: number | null = null
      const collectedAnalyses: {
        pageNumber: number
        isReferencesStart: boolean
        isNewSectionStart: boolean
        containsReferences: boolean
      }[] = []

      // Search backwards from the end
      for (let i = images.length - 1; i >= 0; i--) {
        const base64Image = images[i]
        const imageData = `data:image/jpeg;base64,${base64Image}`

        setProgress(`Checking page ${i + 1}...`)

        const analysis = await analyzePage(imageData)

        collectedAnalyses.unshift({
          pageNumber: i + 1,
          ...analysis
        })

        if (analysis.isReferencesStart) {
          referencesSectionStart = i
          break
        }
      }

      setPageAnalyses(collectedAnalyses)

      if (referencesSectionStart === null) {
        setProgress('No references section found in the document.')
        return
      }

      // Step 3: Process the references section and get markdown content
      setProgress(
        `Found references section starting on page ${referencesSectionStart + 1}`
      )

      const collectedResults: PageResult[] = []

      // Use the collected analyses instead of looking them up from state
      for (let i = referencesSectionStart; i < images.length; i++) {
        const analysis = collectedAnalyses.find((a) => a.pageNumber === i + 1)
        if (!analysis) continue

        // Don't break on new section if it's also the references start
        if (
          (analysis.isNewSectionStart && !analysis.isReferencesStart) ||
          !analysis.containsReferences
        ) {
          referencesSectionEnd = i - 1
          setProgress('Reached end of references section')
          break
        }

        const base64Image = images[i]
        const imageData = `data:image/jpeg;base64,${base64Image}`

        // Get markdown content
        const markdownResponse = await fetch('/api/llama-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: imageData,
            mode: 'free'
          })
        })

        if (!markdownResponse.ok) {
          throw new Error('Failed to extract references content')
        }

        const { markdown: pageMarkdown } = await markdownResponse.json()

        collectedResults.push({
          pageNumber: i + 1,
          markdown: pageMarkdown,
          isStartOfSection: analysis.isReferencesStart,
          isNewSectionStart: analysis.isNewSectionStart
        })
      }

      setResults(collectedResults)

      // Step 4: Extract structured references
      if (collectedResults.length > 0) {
        setProgress('Extracting references...')
        const referencePagesMarkdown = collectedResults
          .map((r) => r.markdown)
          .join('\n\n')

        try {
          const response = await fetch('/api/references/extract/chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: referencePagesMarkdown })
          })

          if (!response.ok) {
            throw new Error('Failed to extract references')
          }

          const data = await response.json()
          if (data.references) {
            setReferences(data.references)
            setProgress(`✅ Extracted ${data.references.length} references`)
          }
        } catch (error) {
          console.error('Error in reference extraction:', error)
          throw new Error('Failed to extract references')
        }
      }

      if (referencesSectionEnd === null && collectedResults.length > 0) {
        referencesSectionEnd = images.length - 1
      }

      setProgress(
        '✅ Processing complete! Found references section from ' +
          `page ${referencesSectionStart + 1} to page ${
            referencesSectionEnd !== null
              ? referencesSectionEnd + 1
              : referencesSectionStart + 1
          }`
      )
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Reference Extractor</h1>

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
          <div className="text-lg font-semibold">
            Found {references.length} references
          </div>
          <ReferenceGrid references={references} />
        </div>
      )}

      {pageAnalyses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Page Analysis Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-600">
                  <th className="border border-gray-300 px-4 py-2">Page</th>
                  <th className="border border-gray-300 px-4 py-2">
                    References Start
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    New Section Start
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Contains References
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageAnalyses.map((analysis) => (
                  <tr key={analysis.pageNumber}>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {analysis.pageNumber}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {analysis.isReferencesStart ? '✅' : '❌'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {analysis.isNewSectionStart ? '✅' : '❌'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {analysis.containsReferences ? '✅' : '❌'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {results.map((result) => (
        <div key={result.pageNumber} className="mb-8">
          <h2 className="text-xl font-semibold mb-2">
            {result.isStartOfSection
              ? '📚 References Section Starts Here - Page ' + result.pageNumber
              : 'References continued on page ' + result.pageNumber}
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
              <h3 className="text-lg font-medium mb-2">Extracted References</h3>
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
