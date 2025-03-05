import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'


export const maxDuration = 300

async function analyzePage({
  together,
  visionLLM,
  imageData,
  parsedText
}: {
  together: Together
  visionLLM: string
  imageData: string
  parsedText: string
}) {
  //console.log('LLM input:', parsedText)



  const systemPrompt = `Extracted text from the page: ${parsedText}

    Using both the image and the extracted text above, please answer:

    1. Does this page contain a header like "References", "Bibliography", "Works Cited", just before a series of references?
    2. Is this the START of a new section (contains a header like "Appendix", "Supplementary Material", etc.)?
    3. Does this page contain reference entries?

    Pay special attention to the extracted text to identify section headers and reference patterns.

    Respond ONLY IN this exact JSON format without any additional text:
    {
      "isReferencesStart": "yes/no",
      "isNewSectionStart": "yes/no",
      "containsReferences": "yes/no"
    }
    ONLY respond in JSON format.

    Response:`

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

  //console.log('LLM output:', output.choices[0]?.message?.content)

  if (output.choices?.[0]?.message?.content) {
    try {
      const response = JSON.parse(output.choices[0].message.content)
      //console.log('LLM response:', response)
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
    const { filePath, parsedText, model = 'free' } = data

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
      imageData: filePath,
      parsedText: parsedText || ''
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
