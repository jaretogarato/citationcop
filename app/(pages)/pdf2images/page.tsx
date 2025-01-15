'use client'

import React, { useState } from 'react'

const ImageToPdfPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [range, setRange] = useState<string>('1-')
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRange(event.target.value)
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('pdf', selectedFile)
      formData.append('range', range)

      const response = await fetch('/api/pdf2images', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to process the PDF.')
      }

      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Convert PDF to Images</h1>
      <form onSubmit={handleFormSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="file">Select a PDF:</label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="range">Page Range (e.g., 1-5):</label>
          <input
            id="range"
            type="text"
            value={range}
            onChange={handleRangeChange}
            placeholder="1-"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Upload and Convert'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {images.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Converted Images</h2>
          <div>
            {images.map((image, index) => (
              <img
                key={index}
                src={`data:image/png;base64,${image}`}
                alt={`Page ${index + 1}`}
                style={{ width: '100%', marginBottom: '10px' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageToPdfPage
