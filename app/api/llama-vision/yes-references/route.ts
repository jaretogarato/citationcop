import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'

async function checkForReferences({
  together,
  visionLLM,
  imageData
}: {
  together: Together
  visionLLM: string
  imageData: string
}) {
  const systemPrompt = `Analyze this page and determine if it contains academic references or a bibliography section. 
  Respond with ONLY "yes" or "no". Do not include any other text in your response.`

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
    return output.choices[0].message.content.toLowerCase().includes('yes')
  }
  return false
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

    const hasReferences = await checkForReferences({
      together,
      visionLLM,
      imageData: filePath
    })

    return NextResponse.json({ hasReferences })
  } catch (error) {
    console.error('Reference Check Error:', error)
    return NextResponse.json(
      { error: 'Failed to check for references' },
      { status: 500 }
    )
  }
}