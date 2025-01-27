'use client'

import React, { useState } from 'react'
import { Label } from '@/app/components/ui/label'
import Input from '@/app/components/ui/Input'
import Button from '@/app/components/ui/Button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from '@/app/components/ui/Card'
import { Alert, AlertDescription } from '@/app/components/ui/alert'

const ImageToPdfPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [range, setRange] = useState<string>('1-') // Match the original default
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleRangeChange = (value: string) => {
    setRange(value) // No validation - match original behavior
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
      formData.append('range', range) // Send range directly as provided

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
    <Card className="max-w-lg mx-auto p-6">
      <CardHeader>
        <CardTitle>Convert PDF to Images</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit}>
          <div className="grid w-full items-center gap-1.5 mb-4">
            <Label htmlFor="file">Select a PDF:</Label>
            <input
              ref={fileInputRef}
              className="hidden"
              id="file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="flat"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? selectedFile.name : 'Choose PDF file'}
            </Button>
          </div>

          <div className="grid w-full items-center gap-1.5 mb-4">
            <Label htmlFor="range">Page Range (e.g., 1-5):</Label>
            <Input
              id="range"
              type="text"
              value={range}
              onChange={handleRangeChange}
              placeholder="1-"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Processing...' : 'Upload and Convert'}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {images.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Converted Images</h2>
            <div className="mt-4 space-y-4">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={`data:image/png;base64,${image}`}
                  alt={`Page ${index + 1}`}
                  className="w-full border rounded-md"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-center text-sm text-gray-500">
        Upload a PDF and specify the page range you want to convert.
      </CardFooter>
    </Card>
  )
}

export default ImageToPdfPage
