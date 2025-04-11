// app/api/search/route.ts
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
    const prompt = `Please perform a comprehensive search based on the reference below. 
    
    1. Confirm whether the original source of the reference was confirmed or not. 
    2. Explain how you found it including a list of the sources or platforms you accessed during your search.
    3. If the reference seems incomplete, see if you can locate the missing information. Explain what you found.

    Raw reference: "${reference}"`

    // Call OpenAI API with search capabilities
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini-search-preview-2025-03-11',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful research assistant that repairs incomplete or innacurate references.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extract and format the search results
    //console.log('OpenAI response:', response.choices[0].message.content)

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
