import { NextRequest, NextResponse } from 'next/server'

// CORS Headers
const corsHeaders = new Headers({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
})

const PDF_CONVERTER_URL = process.env.PDF_CONVERTER_URL

// New configuration method
export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'
// This handles the bodyParser: false and sizeLimit configuration
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData()

    const file = formData.get('pdf') as File | null
    const range = formData.get('range') as string | null

    if (!file || !range) {
      return NextResponse.json(
        { error: 'PDF file and range are required.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const serverFormData = new FormData()
    serverFormData.append('pdf', file, file.name || 'file.pdf')
    serverFormData.append('range', range)

    const response = await fetch(PDF_CONVERTER_URL!, {
      method: 'POST',
      body: serverFormData
    })

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