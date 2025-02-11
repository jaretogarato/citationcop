// app/api/references/extract/route.ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

const REFERENCE_EXTRACTION_PROMPT = `Extract the references from the following document. Provide them in the following JSON format:

{
  "references": [
    {
      "authors": ["author name 1", "author name 2"],
      "type": "type of reference (e.g., journal article, conference paper, etc.)",
      "title": "title of the reference",
      "journal": "journal name if applicable",
      "year": "year of publication",
      "DOI": "DOI if available",
      "publisher": "publisher name if available",
      "volume": "volume number if available",
      "issue": "issue number if available",
      "pages": "page range if available",
      "conference": "conference name if applicable",
      "url": "URL if available. Do NOT create a URL if it does not exist.",
      "date_of_access": "date of access if applicable, will come after url"
      "raw": the raw text of the reference itself. This is the text that was parsed to create this reference.
    }
  ]
}

Do not include the article itself as a reference. It is OK to have 0 references found.

Text:

{text}

References (in JSON format):`

export async function POST(request: Request) {
  const startTime = performance.now()
  
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const llmStartTime = performance.now()
    const response = await openAI.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: REFERENCE_EXTRACTION_PROMPT.replace('{text}', text)
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
    const llmEndTime = performance.now()

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const result = JSON.parse(content)
    const endTime = performance.now()
    
    console.log(`📊 Reference extraction timing:
      Total time: ${(endTime - startTime).toFixed(2)}ms
      LLM time: ${(llmEndTime - llmStartTime).toFixed(2)}ms
      Input length: ${text.length} chars
      References found: ${result.references?.length || 0}`)

    return NextResponse.json(result)
  } catch (error) {
    const endTime = performance.now()
    console.error('Error in reference extraction:', error)
    console.log(`❌ Failed extraction after ${(endTime - startTime).toFixed(2)}ms`)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to extract references'
      },
      { status: 500 }
    )
  }
}