// app/api/references/extract/stream/route.ts
import OpenAI from 'openai'

export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return new Response('Text is required', { status: 400 })
    }

    const prompt = `Extract all references from the text below and return them as a JSON array of references. Each reference should be in this format:
    {
      "authors": ["author1", "author2"],
      "type": "type of reference",
      "title": "title",
      "journal": "journal if applicable",
      "year": "year",
      "DOI": "DOI if available",
      "publisher": "publisher if available",
      "volume": "volume if available",
      "issue": "issue if available",
      "pages": "page range if available",
      "conference": "conference if applicable",
      "url": "URL if available",
      "date_of_access": "access date if applicable",
      "raw": "raw reference text"
    }

    Text to process:
    ${text}`

    const stream = await openAI.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      stream: true
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let buffer = ''
        
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            buffer += content
            
            // Try to parse the accumulated buffer as JSON
            if (buffer.includes(']')) {
              try {
                const json = JSON.parse(buffer)
                if (Array.isArray(json)) {
                  // Send each reference individually
                  for (const ref of json) {
                    await controller.enqueue(encoder.encode(JSON.stringify(ref) + '\n'))
                  }
                  break
                }
              } catch {
                // Not complete JSON yet, continue buffering
              }
            }
          }
          
          // Signal we're done
          await controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain', // Changed to text/plain since we're sending JSONL
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error in reference extraction:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to extract references' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}