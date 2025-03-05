import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'

export const maxDuration = 300
export const runtime = 'edge'

// Helper functions
function isBase64Image(str: string) {
  return str.startsWith('data:image/')
}

async function getMarkDown({
  together,
  visionLLM,
  imageData,
  parsedText
}: {
  together: Together
  visionLLM: string
  imageData: string
  parsedText?: string
}) {
  const systemPrompt = `You are converting a reference section in this image to Markdown format.

Below is the extracted text from the page:
${parsedText || ''}

Using both the image and the extracted text above, please convert the references to Markdown format.

Requirements:
- Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
- No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
- Content: Capture only the references. DO include the ending of references that might be coming from the page before. Do not capture the header or footer sections.
- Use the extracted text to ensure accuracy, especially for:
  * Author names and initials
  * Years and dates
  * Journal names and volume numbers
  * DOIs and URLs
  * Special characters and symbols`

  console.log('systemPrompt: ', systemPrompt)

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
  //console.log('maxDuration: ', maxDuration)
  //console.log('runtime: ', runtime)

  try {
    const data = await request.json()
    const { filePath, parsedText, model = 'Llama-3.2-90B-Vision' } = data

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
      imageData,
      parsedText
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
