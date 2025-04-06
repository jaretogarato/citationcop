import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ReferenceRequest {
  reference: string
}

interface Annotation {
  type: 'url_citation'
  start_index: number
  end_index: number
  url: string
  title?: string
}

interface AIResponse {
  status: 'success' | 'error'
  output_text?: string
  citations?: Annotation[]
  error?: string
  details?: string
  openai_error?: any
}

export async function POST(req: NextRequest) {
  try {
    const body: ReferenceRequest = await req.json()

    if (!body.reference || typeof body.reference !== 'string') {
      return NextResponse.json<AIResponse>(
        {
          status: 'error',
          error: 'Invalid request: reference must be a non-empty string'
        },
        { status: 400 }
      )
    }

    const input = `You are an AI search tool. please do the following:
    
    - use multiple searchers to locate the reference.
    - if the reference is a just a website or a blog, try to confirm the url matches the content.  
    
   - present the following information in the response:
   If you find the reference, provide the top URLs with 2-3 sentence summaries that support the reference 

   If the reference is a website or blog, confirm the URL matches the content.
   
   If you can't find the reference, simply state that it wasn't found and describe the searches you used.

    Reference: "${body.reference}"`

    //console.log('OpenAI request:', input)
    /*const input: string =
      'try to find the reference in the following text: ' + body.reference*/
    console.log('OpenAI request:', input)
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.0,
      tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
      input: input
    })

    console.log('OpenAI response:', response)

    // Extract output_text from top-level field
    const outputText = response.output_text

    // Extract annotations from message block inside output array
    const messageBlock = response.output?.find(
      (block) => block.type === 'message' && 'content' in block
    )

    const contentBlock = messageBlock?.content?.[0]
    const annotations =
      contentBlock?.type === 'output_text'
        ? ((contentBlock.annotations ?? []).filter(
            (annotation) => annotation.type === 'url_citation'
          ) as Annotation[])
        : []

    //console.log('***WEBSEARCH RESULTS response:', outputText)
    //console.log('***WEBSEARCH RESULTS annotations:', annotations)
    return NextResponse.json<AIResponse>(
      {
        status: 'success',
        output_text: outputText,
        citations: annotations
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('OpenAI API error:', error)

    return NextResponse.json<AIResponse>(
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
