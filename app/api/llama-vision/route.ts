import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'

// Helper functions
function isBase64Image(str: string) {
  return str.startsWith('data:image/')
}

//function extractBase64Data(dataUrl: string) {//
//  const base64Data = dataUrl.split(',')[1]
//  return base64Data
//}

async function getMarkDown({
  together,
  visionLLM,
  imageData
}: {
  together: Together
  visionLLM: string
  imageData: string
}) {
  const systemPrompt = `Convert the provided image into Markdown format. Ensure that all content from the page is included, such as headers, footers, subtexts, images (with alt text if possible), tables, and any other elements.
  Requirements:
  - Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
  - No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
  - Complete Content: Do not omit any part of the page, including headers, footers, and subtext.
  `

  const output = await together.chat.completions.create({
    model: visionLLM,
    messages: [
      {
        role: 'user',

        content: [
          { type: 'text', text: systemPrompt },
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      }
    ]
  })

  if (
    output.choices &&
    output.choices[0] &&
    output.choices[0].message &&
    output.choices[0].message.content
  ) {
    return output.choices[0].message.content
  } else {
    throw new Error('Invalid response from Together API')
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { filePath, model = 'Llama-3.2-90B-Vision' } = data

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath or base64 image data is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.TOGETHER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TOGETHER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const visionLLM =
      model === 'free'
        ? 'meta-llama/Llama-Vision-Free'
        : `meta-llama/${model}-Instruct-Turbo`

    const together = new Together({
      apiKey
    })

    // If it's already a base64 data URL or remote URL, use it directly
    const imageData = isBase64Image(filePath) ? filePath : filePath

    const finalMarkdown = await getMarkDown({
      together,
      visionLLM,
      imageData
    })

    return NextResponse.json({ markdown: finalMarkdown })
  } catch (error) {
    console.error('OCR Error:', error)
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}
