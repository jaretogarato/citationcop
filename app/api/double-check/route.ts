// app/api/double-check/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const API_KEYS = [
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3
].filter((key): key is string => {
  if (!key) {
    console.warn('Missing OpenAI API key')
    return false
  }
  return true
})

const openAIInstances = API_KEYS.map((apiKey) => new OpenAI({ apiKey }))

export async function POST(request: Request) {
  try {
    const { reference, keyIndex } = await request.json()

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference is required' },
        { status: 400 }
      )
    }

    if (keyIndex >= openAIInstances.length) {
      return NextResponse.json({ error: 'Invalid key index' }, { status: 400 })
    }

    const openAI = openAIInstances[keyIndex]
    const startTime = Date.now()
    const prompt = `You are a machine that validates parsed academic references by comparing them to their original raw text. You need to verify if the parsing was accurate and suggest corrections if needed.

        Raw Reference Text: "${reference.raw}"
        
        Parsed Reference:
        ${JSON.stringify(reference, null, 2)}
        
        Compare the raw reference text with the parsed version and:
        1. Verify the accuracy of the parsed reference.
        2. If the parsed reference is incorrect, suggest the corrected version.
        3. If the raw text contains multiple references, parse them into separate references.
        
        If the reference is correct, respond with:
        [{ "ok": true }]
        
        If the reference needs correction or contains multiple references, respond with an array of references:
        [
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
                "date_of_access": "date of access if applicable",
                "raw": "raw reference text for this specific reference"
            }
        ]`

    const response = await openAI.chat.completions.create({
      model: process.env.LLM_MODEL_ID || 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.0
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content received from LLM')
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in response')
    }

    const result = JSON.parse(jsonMatch[0])
    /*console.log(
      `Reference processed in ${Date.now() - startTime}ms with key ${keyIndex}`
    )*/

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
