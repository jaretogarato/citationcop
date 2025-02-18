// app/api/references/verify-search/route.ts
import { NextResponse } from 'next/server'

async function fetchGoogleSearchResults(query: string) {
  const apiKey = process.env.SERPER_API_KEY as string

  const data = JSON.stringify({
    "q": query,
    "num": 10
  })

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: data,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`)
    }

    const responseData = await response.json()
    // Just return the organic search results
    return {
      status: 'success',
      organic: responseData.organic?.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet
      }))
    }
  } catch (error) {
    console.error("Error fetching search results:", error)
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch search results'
    }
  }
}

export async function POST(request: Request) {
  try {
    const { reference } = await request.json()

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference is required' },
        { status: 400 }
      )
    }

    const results = await fetchGoogleSearchResults(reference)
    return NextResponse.json(results)

  } catch (error) {
    console.error('Error in search verification:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}