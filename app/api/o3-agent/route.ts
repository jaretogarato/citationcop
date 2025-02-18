// app/api/o3-agent/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { referenceTools } from '@/app/lib/reference-tools'

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const {
      reference,
      iteration = 0,
      previousMessages = [],
      functionResult = null,
      lastToolCallId = null
    } = await request.json()

    console.log(`\n=== Starting Iteration ${iteration} ===`)
    console.log(`Reference text: ${reference?.substring(0, 100)}...`)
    console.log(`Previous messages: ${previousMessages?.length}`)

    // Always ensure we have a valid messages array
    let messages: ChatCompletionMessageParam[] = []

    if (previousMessages?.length > 0) {
      messages = [...previousMessages]
      // If we have a function result from previous iteration, add it
      if (functionResult && lastToolCallId) {
        messages.push({
          role: 'tool',
          tool_call_id: lastToolCallId,
          content: JSON.stringify(functionResult)
        })
      }
    } else {
      // Initial messages if we don't have any previous ones
      messages = [
        {
          role: 'system',
          content: `You are a reference verification assistant. Your task is to verify academic and web references using available tools.

A reference status must be one of:
- "verified": if validity can be confirmed with high confidence
- "unverified": if there is no evidence of its existence
- "needs-human": if the reference exists but has discrepancies or missing information that requires human verification

When searching:
1. First identify key elements from the reference (authors, title, year, publication)
2. Create specific search queries using these elements - prioritize exact titles and author names
3. If the first search isn't conclusive, try alternative queries focusing on different elements
4. Analyze search results by looking for:
   - Exact title matches
   - Author name matches
   - Publication/venue matches
   - Year matches
   - Similar content descriptions

Return a final JSON response only when you have sufficient evidence:
{
  "status": "verified" | "unverified" | "needs-human" ,
  "message": "Detailed explanation of findings. Include relevant links if available. Use formatting if helpful."
  "reference": "Reference in APA format including any new information found."
}

Do NOT use tool_calls when giving your final response. Make sure to try multiple searches if the first attempt is inconclusive.`
        },
        {
          role: 'user',
          content: `Please verify this reference: ${reference}`
        }
      ]
    }

    // Verify we have messages before making the API call
    if (!messages || messages.length === 0) {
      throw new Error('No messages available for LLM call')
    }

    console.log('Messages to send:', messages.length)
    console.log('First message role:', messages[0]?.role)
    console.log('Last message role:', messages[messages.length - 1]?.role)

    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages,
      tools: referenceTools,
      store: true
    })

    const message = completion.choices[0].message
    console.log('LLM Response received :', message.content)

    const tokenUsage = completion.usage
    console.log('Token usage:', tokenUsage)

    // If no tool_calls, we have our final answer
    if (!message.tool_calls) {
      console.log('Final answer received')
      try {
        if (message.content === null) {
          throw new Error('Message content is null')
        }
        const result = JSON.parse(message.content)
        return NextResponse.json({
          status: 'complete',
          result,
          messages: [...messages, message],
          tokenUsage: tokenUsage // Add token usage here too
        })
      } catch (e) {
        return NextResponse.json({
          status: 'error',
          error: 'Invalid final response format',
          messages: [...messages, message],
          tokenUsage: tokenUsage // And here for consistency
        })
      }
    }

    // If we have tool calls, return the first one to be executed
    const toolCall = message.tool_calls[0]
    console.log('Function to call:', toolCall.function.name)

    // Return what we need for the next iteration
    return NextResponse.json({
      status: 'pending',
      messages: [...messages, message], // Include the assistant's message with tool calls
      iteration: iteration + 1,
      functionToCall: {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      },
      lastToolCallId: toolCall.id,
      tokenUsage: tokenUsage // Add the token usage information
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
