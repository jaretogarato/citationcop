// app/api/references/verify-search-scholar/route.ts
import { NextResponse } from 'next/server'

export const maxDuration = 300

async function fetchGoogleScholarResults(query: string) {
  const apiKey = process.env.SERPER_API_KEY as string

  const data = JSON.stringify({
    q: query,
    num: 10
  })

  try {
    const response = await fetch('https://google.serper.dev/scholar', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: data
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`)
    }

    const responseData = await response.json()

    /*console.log(
      'scholar results:',
      responseData.organic.map((result: any) => result.title),
      responseData.organic.map((result: any) => result.link),
      responseData.organic.map((result: any) => result.snippet)
    )*/

    // Just return the organic search results
    return {
      success: true,
      status: 'success',
      organic: responseData.organic?.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet
      }))
    }
  } catch (error) {
    console.error('Error fetching search results:', error)
    return {
      success: false,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to fetch search results'
    }
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    //console.log('@@@@@@@Raw request body:', rawBody)
    const { query } = JSON.parse(rawBody)
    //console.log('!!!!!!!!!!!!!!!!!!!!!!!Parsed query:', query)

    //console.log('scholar query: !!!', query)

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const results = await fetchGoogleScholarResults(query)
    /*console.log(
      'SCHOLAR results:',
      results.organic.map((result: any) => result.title),
      results.organic.map((result: any) => result.link),
      results.organic.map((result: any) => result.snippet)
    )*/

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in scholar search verification:', error)
    return NextResponse.json(
      { error: 'Failed to perform scholar search' },
      { status: 500 }
    )
  }
}
