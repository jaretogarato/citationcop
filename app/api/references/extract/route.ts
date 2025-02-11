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
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

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

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    return NextResponse.json(JSON.parse(content))
  } catch (error) {
    console.error('Error in reference extraction:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to extract references'
      },
      { status: 500 }
    )
  }
}

// app/services/reference-extraction-service.ts
export class ReferenceExtractionService {
  private static CHUNK_SIZE = 4000

  private splitIntoChunks(text: string): string[] {
    const references = text
      .split(/\n/)
      .map((ref) => ref.trim())
      .filter((ref) => ref.length > 0)

    const chunks: string[] = []
    let currentChunk = ''

    for (const ref of references) {
      if ((currentChunk + '\n' + ref).length > ReferenceExtractionService.CHUNK_SIZE && currentChunk) {
        chunks.push(currentChunk)
        currentChunk = ref
      } else {
        currentChunk += (currentChunk ? '\n' : '') + ref
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  private async processChunk(chunk: string): Promise<any> {
    const response = await fetch('/api/references/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk })
    })

    if (!response.ok) {
      throw new Error('Failed to process chunk')
    }

    return response.json()
  }

  async processText(text: string): Promise<any> {
    // For short texts, process directly
    if (text.length <= ReferenceExtractionService.CHUNK_SIZE) {
      return this.processChunk(text)
    }

    // Split into chunks and process
    const chunks = this.splitIntoChunks(text)
    const allReferences: any[] = []

    // Process chunks sequentially to avoid overwhelming the API
    for (const chunk of chunks) {
      try {
        const result = await this.processChunk(chunk)
        if (result.references && Array.isArray(result.references)) {
          allReferences.push(...result.references)
        }
      } catch (error) {
        console.error('Error processing chunk:', error)
        // Continue processing other chunks even if one fails
      }
    }

    // Remove duplicates
    const seen = new Set()
    const uniqueReferences = allReferences.filter(ref => {
      const key = ref.DOI || ref.raw
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return { references: uniqueReferences }
  }
}

/*import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'edge' /// will have to switch to serverless when go pro.

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

export async function POST(request: Request) {
  try {
    //console.log('*** Extracting references request received. In edge Function *** ');
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const prompt = `Extract the references from the following document. Provide them in the following JSON format:

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

Do not include the the article itself as a reference. It is OK to have 0 references found.

Text:

${text}

References (in JSON format):`

    const response = await openAI.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    })

    let content = response.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No content received from LLM' },
        { status: 500 }
      )
    }

    // Extract JSON content
    const jsonStartIndex = content.indexOf('{')
    const jsonEndIndex = content.lastIndexOf('}')

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1)
    } else {
      return NextResponse.json(
        { error: 'Response does not contain recognizable JSON structure' },
        { status: 500 }
      )
    }

    const parsedContent = JSON.parse(content)

    if (!parsedContent.references || !Array.isArray(parsedContent.references)) {
      return NextResponse.json(
        { error: 'Parsed JSON does not contain a references array' },
        { status: 500 }
      )
    }
    //console.log('*** Extracted content :', parsedContent)
    return NextResponse.json(parsedContent)
  } catch (error) {
    console.error('Error in reference extraction:', error)
    return NextResponse.json(
      { error: 'Failed to extract references' },
      { status: 500 }
    )
  }
}
*/