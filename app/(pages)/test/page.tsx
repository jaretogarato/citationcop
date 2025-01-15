'use client'

import { useState } from 'react'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [responseData, setResponseData] = useState(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
    setResponseData(null)
    setImageSrc(null)
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
      // Read the file as an ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Convert PDF to image
      const imageDataUrl: any = [] // await extractPDFPageAsImage(uint8Array)
      
      setImageSrc(imageDataUrl)

      // Send the image for reference extraction
      const visionResponse = await fetch('/api/open-ai-vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageData: imageDataUrl })
      })

      if (!visionResponse.ok) {
        throw new Error('Failed to get a valid response from the API.')
      }

      const data = await visionResponse.json()
      setResponseData(data)
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Rest of the component remains the same as in your original code
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>PDF to Image Reference Extractor</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button
        onClick={handleProcessPdf}
        style={{
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        disabled={!selectedFile || loading}
      >
        {loading ? 'Processing...' : 'Extract References'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}

      {imageSrc && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            border: '1px solid #ddd'
          }}
        >
          <h2>Generated PDF Image</h2>
          <img
            src={imageSrc}
            alt="Generated PDF page"
            style={{
              maxWidth: '100%',
              height: 'auto',
              border: '1px solid #ccc'
            }}
          />
        </div>
      )}

      {responseData && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            border: '1px solid #ddd'
          }}
        >
          <h2>Extracted References</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(responseData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}