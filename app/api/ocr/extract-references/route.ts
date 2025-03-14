import { NextRequest, NextResponse } from 'next/server'
import { Mistral } from '@mistralai/mistralai'

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { message: 'Mistral API key is not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { message: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Convert uploaded file to Buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Initialize Mistral client
    const client = new Mistral({ apiKey })

    // Step 1: Upload the file to Mistral's servers
    const uploadedFile = await client.files.upload({
      file: {
        fileName: file.name,
        content: fileBuffer
      },
      // force type assertion to satisfy the FilePurpose type
      purpose: 'ocr' as any
    })

    // Step 2: Get a signed URL for the uploaded file

    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id
    })

    // Step 3: Process the document with OCR
    const ocrResponse = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: signedUrl.url
      }
    })

    // Step 4: Extract just the index and markdown from each page
    const extractedPages = ocrResponse.pages.map((page) => ({
      index: page.index,
      markdown: page.markdown
    }))

    //console.log('DONE GETTINC PAGES')

    // Combine all the markdown content for reference extraction
    const allMarkdown = extractedPages.map((page) => page.markdown).join('\n\n')

    // Step 5: Use chat completion to extract references from the OCR text
    const chatResponse = await client.chat.complete({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please do the following:
              1) Extract the title and authors of this article
              
              2) Extract and list ALL references in the REferences Section from this academic paper. CRITICAL: FIND ALL REFERNCES.
               
              Format each reference as a separate item and maintain their original formatting:\n\n${allMarkdown}`
            }
          ]
        }
      ]
    })

    // Extract the references from the response
    const references =
      chatResponse.choices?.[0]?.message.content || 'No references found'

    //console.log(references)
    // Return the extracted references
    return NextResponse.json({
      references
    })
  } catch (error) {
    console.error('Reference extraction error:', error)
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to extract references'
      },
      { status: 500 }
    )
  }
}
