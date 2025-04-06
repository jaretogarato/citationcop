// app/api/references/verify-openai-repair/route.ts

import { OpenAI } from 'openai'
import { NextRequest, NextResponse } from 'next/server'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { reference } = await req.json()

    // Validate input
    if (!reference || typeof reference !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: reference must be a non-empty string' },
        { status: 400 }
      )
    }

    // Prepare search prompt
    const prompt = `Given the raw reference below:

  "${reference}"

  Search for any missing or incorrect details and provide the complete, correct reference in APA format using only verified information. If you cannot find enough data to confirm the reference, clearly indicate that.
  
  Respond with complete repaired reference including any new details found in APA format.`

    // Call OpenAI API with search capabilities
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini-search-preview-2025-03-11',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful research assistant that fixes incompete or erroneous references.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extract and format the search results
    console.log('OpenAI response:', response.choices[0].message.content)

    return NextResponse.json(
      {
        status: 'success',
        organic: response.choices[0].message.content
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('OpenAI API error:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: 'Error processing request',
        details: error.message,
        ...(error.response ? { openai_error: error.response.data } : {})
      },
      { status: 500 }
    )
  }
}
