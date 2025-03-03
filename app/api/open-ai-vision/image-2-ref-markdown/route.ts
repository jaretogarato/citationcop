import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const maxDuration = 60
export const runtime = 'edge'

// Helper functions
function isBase64Image(str: string) {
  return str.startsWith('data:image/')
}

async function getMarkDown({
  openai,
  imageData,
  parsedText
}: {
  openai: OpenAI
  imageData: string
  parsedText?: string
}) {
  const systemPrompt = `You specialize in optical character recognition and your goal is to convert reference information in this image to Markdown format.

Below is the extracted text from the page: ${parsedText || ''}

Using both the image and the extracted text above, please convert all references to Markdown format.

Requirements:
- CRITICAL: The text at the VERY TOP of the page may be a continuation of a reference from the previous page. Make sure to include it in th output exactly as it is written. 
- Look carefully at the first few lines of text - if they seem to be part of a citation (authors, journal, etc.) but don't start with a number, they are likely the end of a reference from the previous page.
- Output Only Markdown: Return solely the Markdown content without any additional explanations or comments.
- No Delimiters: Do not use code fences or delimiters like \`\`\`markdown.
- Content: Capture ALL references information, including any text at the top of the page that might be the continuation of a reference from the previous page.
- If the first text doesn't have a reference number but looks like publication details, include it in your output.
- Use the extracted text to ensure accuracy. 
- DO NOT add or infer any text. ONLY include information that is present in the image and the text provided above.

- A reference will should have a form like: Smith, J. (2020). My paper. Journal of Papers, 1(2), 3-4. 
DO NOT extract references of form (Smith, 2020) or [1].
` 

  const output = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      }
    ],
    max_tokens: 4096
  })

  if (
    output.choices &&
    output.choices[0] &&
    output.choices[0].message &&
    output.choices[0].message.content
  ) {
    console.log('SYSPROMPT:  ', systemPrompt)
    console.log('RESULT: ', output.choices[0].message.content)
    return output.choices[0].message.content
  } else {
    throw new Error('Invalid response from OpenAI API')
  }
}

export async function POST(request: NextRequest) {
  //console.log('maxDuration: ', maxDuration)
  //console.log('runtime: ', runtime)

  try {
    const data = await request.json()
    const { filePath, parsedText, model } = data

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath or base64 image data is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey
    })

    // If it's already a base64 data URL or remote URL, use it directly
    const imageData = isBase64Image(filePath) ? filePath : filePath

    const finalMarkdown = await getMarkDown({
      openai,
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
