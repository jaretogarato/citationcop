import { NextRequest, NextResponse } from 'next/server'
import { parsePDF } from '@/app/actions/parse-pdf'

export const runtime = 'nodejs' // Ensure this runs in a Node.js environment

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Invalid file uploaded' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    // OLD const parsedText = await parsePDF([...new Uint8Array(arrayBuffer)])
    const parsedText = await parsePDF(new Uint8Array(arrayBuffer))

    return NextResponse.json({ text: parsedText })
  } catch (error) {
    console.error('Error parsing PDF:', error)
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}
