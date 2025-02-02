import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'

async function analyzePage({
  together,
  visionLLM,
  imageData
}: {
  together: Together
  visionLLM: string
  imageData: string
}) {
  const systemPrompt = `Analyze this page and answer these three questions about references:

1. Is this the START of a references section (contains a header like "References", "Bibliography", "Works Cited", etc.)?
2. Is this the START of a new section AFTER references (like "Appendix", "Supplementary Material", etc.)?
3. Does this page contain reference entries (regardless of whether it's the start or middle of the section)?

Respond in this exact JSON format without any additional text:
{
  "isReferencesStart": "yes/no",
  "isNewSectionStart": "yes/no",
  "containsReferences": "yes/no"
}`

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

  if (output.choices?.[0]?.message?.content) {
    try {
      const response = JSON.parse(output.choices[0].message.content)
      return {
        isReferencesStart: response.isReferencesStart.toLowerCase() === 'yes',
        isNewSectionStart: response.isNewSectionStart.toLowerCase() === 'yes',
        containsReferences: response.containsReferences.toLowerCase() === 'yes'
      }
    } catch (error) {
      console.error('Error parsing LLM response:', error)
      return {
        isReferencesStart: false,
        isNewSectionStart: false,
        containsReferences: false
      }
    }
  }
  
  return {
    isReferencesStart: false,
    isNewSectionStart: false,
    containsReferences: false
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

    const analysis = await analyzePage({
      together,
      visionLLM,
      imageData: filePath
    })

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Page Analysis Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze page' },
      { status: 500 }
    )
  }
}