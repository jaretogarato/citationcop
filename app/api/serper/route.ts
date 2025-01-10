// app/api/serper/route.ts
import { NextResponse } from 'next/server'

const apiKey = process.env.SERPER_API_KEY

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const { q } = await request.json()

    if (!q) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('Searching:', q)

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q,
        num: 10
      })
    })

    if (!response.ok) {
      throw new Error(`Search failed for query: ${q}`)
    }

    const results = await response.json()
    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to process search request' },
      { status: 500 }
    )
  }
}
