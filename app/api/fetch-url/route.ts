// app/api/fetch-url/route.ts
import { NextResponse } from 'next/server'

export const maxDuration = 300

async function fetchUrlContent(rawUrl: string): Promise<string> {
  try {
    // Sanitize and validate URL
    let urlToFetch = rawUrl
    if (
      !urlToFetch.startsWith('http://') &&
      !urlToFetch.startsWith('https://')
    ) {
      urlToFetch = 'https://' + urlToFetch
    }

    // Validate URL
    try {
      new URL(urlToFetch) // This will throw if invalid
    } catch (e) {
      throw new Error(`Invalid URL format: ${rawUrl}`)
    }

    //console.log('Fetching URL:', urlToFetch)
    const response = await fetch(urlToFetch, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReferenceValidator/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/json')
    ) {
      throw new Error('Unsupported content type: ' + contentType)
    }

    const rawContent = await response.text()

    // Clean the content
    const cleanContent = rawContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, '')
      .trim()
      .slice(0, 15000)

    if (!cleanContent) {
      throw new Error('No readable content found on page')
    }

    return cleanContent
  } catch (error) {
    throw new Error(
      `Failed to fetch URL content: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    //console.log('*********** Received URL:', url)

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const content = await fetchUrlContent(url)
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error fetching URL:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
