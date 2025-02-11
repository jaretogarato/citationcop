// app/api/references/extract/route.ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// ENDPOINT NO LONGER USED --- DEPRECATED //

export const maxDuration = 60
export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function splitIntoChunks(text: string, maxChunkSize: number = 4000): string[] {
  // Split on newlines and look for numbered references or author patterns
  const references = text
    .split(/\n/)
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0) // Remove empty lines

  const chunks: string[] = []
  let currentChunk = ''

  for (const ref of references) {
    // If adding this reference would exceed maxChunkSize and we have content
    if ((currentChunk + '\n' + ref).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk)
      currentChunk = ref
    } else {
      // Add to current chunk with proper spacing
      currentChunk += (currentChunk ? '\n' : '') + ref
    }
  }

  // Add the final chunk if we have one
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  // Debug logging
  /*chunks.forEach((chunk, i) => {
    const references = chunk.split('\n')
    console.log(`\nChunk ${i + 1} (${chunk.length} chars):`)
    console.log(`Contains ${references.length} references`)
    console.log('First reference:', references[0])
    console.log('Last reference:', references[references.length - 1])
  })*/

  return chunks
}

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

Do not include the the article itself as a reference. It is OK to have 0 references found.

Text:

{text}

References (in JSON format):`

async function processChunkWithRetry(
  chunk: string,
  maxRetries = 3
): Promise<any> {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      console.log('Processing chunk:', chunk)
      const response = await openAI.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: REFERENCE_EXTRACTION_PROMPT.replace('{text}', chunk)
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      return JSON.parse(content)
    } catch (error: any) {
      attempt++

      // Check if it's a rate limit error
      if (
        error?.status === 429 ||
        (error?.message && error.message.includes('rate limit'))
      ) {
        if (attempt === maxRetries) {
          throw new Error('Rate limit exceeded after maximum retries')
        }

        // Exponential backoff: 2^attempt seconds (2, 4, 8 seconds)
        const backoffTime = Math.pow(2, attempt) * 1000
        /*console.log(
          `Rate limit hit, retrying in ${backoffTime / 1000} seconds...`
        )*/
        await sleep(backoffTime)
        continue
      }

      // If it's not a rate limit error and we're out of retries, throw
      if (attempt === maxRetries) {
        throw error
      }

      // For other errors, wait a shorter time
      await sleep(1000)
    }
  }
  throw new Error('Failed after max retries')
}

async function processBatch(chunks: string[]): Promise<any[]> {
  try {
    const results = await Promise.all(
      chunks.map((chunk) => processChunkWithRetry(chunk))
    )
    return results
  } catch (error) {
    console.error('Error processing batch:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()
   //console.log('******* Received text:', text)
   // console.log('----------------------------')

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // For short texts, process directly
    if (text.length <= 4000) {
      try {
        const result = await processChunkWithRetry(text)
        return NextResponse.json(result)
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to process text: ${error.message}`)
        } else {
          throw new Error('Failed to process text: Unknown error')
        }
      }
    }

    // Split into chunks and process
    const chunks = splitIntoChunks(text)
    const allReferences: any[] = []

    // Process chunks in batches of 3
    for (let i = 0; i < chunks.length; i += 3) {
      const batchChunks = chunks.slice(i, i + 3)

      try {
        const batchResults = await processBatch(batchChunks)

        for (const result of batchResults) {
          if (result.references && Array.isArray(result.references)) {
            allReferences.push(...result.references)
          }
        }
      } catch (error) {
        console.error(`Error processing batch starting at chunk ${i}:`, error)
        if (error instanceof Error) {
          throw new Error(
            `Failed to process references batch: ${error.message}`
          )
        } else {
          throw new Error('Failed to process references batch: Unknown error')
        }
      }
    }

    // Remove duplicates
    const uniqueReferences = allReferences.filter(
      (ref, index, self) =>
        index ===
        self.findIndex(
          (r) => r.raw === ref.raw || (r.DOI && ref.DOI && r.DOI === ref.DOI)
        )
    )

    return NextResponse.json({ references: uniqueReferences })
  } catch (error) {
    console.error('Error in reference extraction:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract references'
      },
      { status: 500 }
    )
  }
}
