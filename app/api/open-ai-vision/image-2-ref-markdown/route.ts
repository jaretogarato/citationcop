import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { logTokenUsage } from '@/app/lib/usage-logger'

// --- Constants ---
//const MODEL_NAME = 'o1'
const MODEL_NAME = 'gpt-4o-mini'
const API_ENDPOINT = 'open-ai-vision/image-2-ref-markdown'

export const maxDuration = 300

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
  const systemPrompt = `You specialize in optical character recognition and your goal is to extract only the full references in this image to text as accurately as possible.

  Below is extracted text from the page: ${parsedText || ''} Using the extracted text above to double check the letters.

Requirements:
- CRITICAL: The text at the VERY TOP of the page may be a continuation of a reference from the previous page. Make sure to include it in the output exactly as it is written. 
- Look carefully at the first few lines of text - if they seem to be part of a citation (authors, journal, etc.) but don't start with a number, they are likely the end of a reference from the previous page.
- DO NOT add or infer any text. ONLY include information that is present in the image and the text provided above.
- A reference will should have a form like: Smith, J. (2020). My paper. Journal of Papers, 1(2), 3-4. 
- DO NOT extract references of form (Smith, 2020) or [1].
- IF the page is two columns, make sure to look on both the left and right columns for references.
`

  const output = await openai.chat.completions.create({
    model: MODEL_NAME,
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
    ]
  })

  // --- Log Token Usage ---
  if (output.usage) {
    console.log('OpenAI Usage Data:', output.usage)
    console.log(
      'Cahced tokens: ',
      output.usage.prompt_tokens_details?.cached_tokens
    )
    // Call logTokenUsage asynchronously (don't await) and catch errors
    logTokenUsage({
      modelName: MODEL_NAME, // Pass the model name used
      totalTokens: output.usage.total_tokens,
      promptTokens: output.usage.prompt_tokens,
      completionTokens: output.usage.completion_tokens,
      cachedTokens: output.usage.prompt_tokens_details?.cached_tokens,
      apiEndpoint: API_ENDPOINT
    }).catch((err) => {
      console.error(`Error logging token usage for ${API_ENDPOINT}:`, err)
    })
  } else {
    console.warn(
      `Warning: OpenAI response for ${API_ENDPOINT} did not include usage data.`
    )
  }
  // --- End Log Token Usage ---

  if (
    output.choices &&
    output.choices[0] &&
    output.choices[0].message &&
    output.choices[0].message.content
  ) {
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
