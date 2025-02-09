import { NextRequest, NextResponse } from 'next/server'

// Add a default URL or use non-null assertion
const PDF_CONVERTER_URL = process.env.PDF_CONVERTER_URL

//console.log('PDF_CONVERTER_URL: ', PDF_CONVERTER_URL)
export const config = {
  api: {
    // Increase the body size limit and disable body parsing
    bodyParser: false,
    sizeLimit: '10mb'
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('Request received at /api/pdf2images')

    const formData = await req.formData()
    console.log('FormData parsed successfully')

    const file = formData.get('pdf') as File | null
    const range = formData.get('range') as string | null

    console.log('File size:', file?.size, 'bytes')
    console.log('Range:', range)

    if (!file || !range) {
      return NextResponse.json(
        { error: 'PDF file and range are required.' },
        { status: 400 }
      )
    }

    const serverFormData = new FormData()
    serverFormData.append('pdf', file, file.name || 'file.pdf')
    serverFormData.append('range', range)
    console.log('Server FormData created successfully')
    // Add this log
    const serverFile = serverFormData.get('pdf') as File
    console.log(
      'Server FormData file size:',
      serverFile.size / (1024 * 1024).toFixed(2),
      'MB'
    )

    const response = await fetch(PDF_CONVERTER_URL!, {
      method: 'POST',
      body: serverFormData
    })
    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
      throw new Error(`Server Error: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Detailed error in /api/pdf2images:', error)
    return NextResponse.json(
      { error: 'Failed to process the PDF. Please try again later.' },
      { status: 500 }
    )
  }
}
