import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'

// Helper functions
function isBase64Image(str: string) {
  return str.startsWith('data:image/')
}

async function getMarkDown({
  together,
  visionLLM,
  imageData
}: {
  together: Together
  visionLLM: string
  imageData: string
}) {
  /*  const systemPrompt = `Convert the provided image into Markdown format. Do not capture the header and footer. 
  Requirements:
  - Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
  - No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
  - Content: Only get the core of the page, do not include headers or  footers
  `*/
  const systemPrompt = `You are converting a reference section in this image to Markdown format. 
  Requirements:
  - Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
  - No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
  - Content: Capture all references. Be careful to include the ending of references that might be coming from the page before. Do not capture the header or footer sections. 
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
