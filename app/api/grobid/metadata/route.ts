import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

import {
  Author,
  DocumentMetadata,
  MetadataResponse
} from '@/app/types/reference'

export const runtime = 'edge'

const GROBID_HOST = process.env.GROBID_HOST || 'http://localhost:8070'

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true
} as const

function parseMetadata(xml: string): DocumentMetadata {
  const parser = new XMLParser(parserOptions)
  const result = parser.parse(xml)

  const sourceDesc = result?.TEI?.teiHeader?.fileDesc?.sourceDesc?.biblStruct

  if (!sourceDesc) {
    return {
      title: null,
      authors: [],
      date: null
    }
  }

  const analytic = sourceDesc.analytic || {}
  const monogr = sourceDesc.monogr || {}

  // Extract title
  const title = analytic.title?.['#text'] || null

  // Extract authors with affiliations
  const rawAuthors = analytic.author || []
  const authorArray = Array.isArray(rawAuthors) ? rawAuthors : [rawAuthors]

  const authors = authorArray
    .map((author) => {
      if (!author?.persName) return null

      const firstName = author.persName.forename?.['#text'] || ''
      const surname =
        author.persName.surname?.['#text'] || author.persName.surname || ''
      const name = `${firstName} ${surname}`.trim()

      // Extract organization if available
      const organization = author.affiliation?.orgName?.['#text'] || null

      return name ? { name, organization: organization || null } : null
    })
    .filter((author): author is Author => author !== null)

  // Extract date
  const date = monogr?.imprint?.date?.['@_when'] || null

  return {
    title,
    authors,
    date
  }
}

export default async function handler(
  req: NextRequest
): Promise<NextResponse<MetadataResponse | { error: string }>> {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      )
    }

    if (!file.type.includes('pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const grobidFormData = new FormData()
    grobidFormData.append(
      'input',
      new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
    )

    const response = await fetch(`${GROBID_HOST}/api/processHeaderDocument`, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        Accept: 'application/xml'
      }
    })

    if (!response.ok) {
      throw new Error('GROBID processing failed')
    }

    const xml = await response.text()
    const metadata = parseMetadata(xml)

    if (!metadata.title) {
      console.warn('No title extracted from document')
    }

    return NextResponse.json({ metadata })
  } catch (error) {
    console.error('Error processing document:', error)
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}
