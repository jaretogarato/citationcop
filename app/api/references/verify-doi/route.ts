// app/api/references/verify-doi/route.ts
import { NextResponse } from 'next/server'
import type { Reference } from '@/app/types/reference'

export const maxDuration = 60
const EMAIL = 'matthewlongshore@gmail.com' // Replace with your email

function calculateTitleSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  
  const arr1 = str1.split('')
  const arr2 = str2.split('')
  
  const matrix = Array(arr1.length + 1).fill(null)
    .map(() => Array(arr2.length + 1).fill(null))
  
  for (let i = 0; i <= arr1.length; i++) matrix[i][0] = i
  for (let j = 0; j <= arr2.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= arr1.length; i++) {
    for (let j = 1; j <= arr2.length; j++) {
      const cost = arr1[i - 1] === arr2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length)
  return 1 - (matrix[arr1.length][arr2.length] / maxLength)
}

function compareMetadata(reference: Reference, crossrefWork: any): boolean {
  const normalize = (str: string) => 
    str.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  const refTitle = reference.title ? normalize(reference.title) : ''
  const crossrefTitle = crossrefWork.title ? normalize(crossrefWork.title[0]) : ''
  
  const similarity = calculateTitleSimilarity(refTitle, crossrefTitle)
  
  return similarity > 0.8
}

async function verifyDOI(reference: Reference): Promise<Reference> {
  if (!reference.DOI) {
    return reference
  }
  
  //console.log('******  Verifying DOI:', reference.DOI)
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(reference.DOI)}?mailto=${EMAIL}`,
      {
        headers: {
          'User-Agent': `CitationVerifier/1.0 (mailto:${EMAIL})`
        }
      }
    )
    
    if (!response.ok) {
      console.error('DOI verification failed:', response.statusText)
      // Handle rate limiting
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return verifyDOI(reference)
      }
      
      return {
        ...reference,
        status: 'error',
        message: `DOI verification failed: ${response.statusText}`
      }
    }
    
    const data = await response.json()
    const work = data.message
    //console.log('result:', data)
    //console.log('Crossref metadata:', work)

    const matches = compareMetadata(reference, work)
    
    if (matches) {
      return {
        ...reference,
        status: 'verified',
        verification_source: 'DOI and Title match via Crossref'
      }
    } else {
      return {
        ...reference,
        status: 'error',
        message: 'DOI exists but metadata mismatch'
      }
    }
    
  } catch (error) {
    return {
      ...reference,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during DOI verification'
    }
  }
}

export async function POST(request: Request) {
  try {
    const { references } = await request.json()
    
    if (!Array.isArray(references)) {
      return NextResponse.json(
        { error: 'Invalid request: references must be an array' },
        { status: 400 }
      )
    }
    
    // Process references sequentially with small delays to be polite
    const verifiedReferences = []
    for (let i = 0; i < references.length; i++) {
      // Add a small delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const result = await verifyDOI(references[i])
      verifiedReferences.push(result)
    }
    
    return NextResponse.json({ references: verifiedReferences })
  } catch (error) {
    console.error('Error in DOI verification:', error)
    return NextResponse.json(
      { error: 'Failed to verify DOIs' },
      { status: 500 }
    )
  }
}