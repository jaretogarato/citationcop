'use server'

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { TextItem } from 'pdfjs-dist/types/src/display/api'

// Disable the worker for server-side usage
GlobalWorkerOptions.workerSrc = ''

export async function parsePDF(binaryData: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocument({ data: binaryData }).promise

    let extractedText: {
      text: string
      x: number
      y: number
      fontSize: number
    }[] = []

    // Extract text from all pages
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()

      // Extract text from items
      const pageText = textContent.items
        .filter((item): item is TextItem => 'transform' in item) // Type guard for TextItem
        .map((item) => ({
          text: item.str,
          x: item.transform[4], // x-coordinate
          y: item.transform[5], // y-coordinate
          fontSize: item.height // Approximate font size
        }))

      extractedText.push(...pageText)
    }

    // Clean and filter the text
    const cleanedText = cleanText(extractedText)

    //console.log('Extracted and cleaned text:', cleanedText)

    return cleanedText
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error('Failed to parse PDF')
  }
}

// Function to clean and filter extracted text
function cleanText(
  extractedText: Array<{ text: string; x: number; y: number; fontSize: number }>
): string {
  let lines = extractedText
    .sort((a, b) => a.y - b.y || a.x - b.x) // Sort by layout order
    .map((item) => item.text)

  // Remove boilerplate content
  lines = lines.filter((line) => !isBoilerplateText(line))

  // Retain lines that might be references or ambiguous
  lines = lines.filter(
    (line) => isPotentialReference(line) || isAmbiguous(line)
  )

  return lines.join('\n')
}

// Function to check if a line is boilerplate
function isBoilerplateText(line: string): boolean {
  const boilerplatePatterns = [
    /^Abstract$/i,
    /^Introduction$/i,
    /^Methodology$/i,
    /^Results$/i,
    /^Discussion$/i,
    /^Conclusion$/i,
    /^Table of Contents$/i,
    /^Appendix$/i,
    /^Page \d+$/i,
    /^\d+$/, // Page numbers
    /^\s*Figure \d+/i, // Figure references
    /^\s*Table \d+/i // Table references
  ]

  return boilerplatePatterns.some((pattern) => pattern.test(line.trim()))
}

// Function to check if a line is a potential reference
function isPotentialReference(line: string): boolean {
  const hasYear = /\b(19|20)\d{2}\b/.test(line)
  const hasAuthors =
    /([A-Z][a-z]+[\s,]+){1,}/.test(line) ||
    /[A-Z][a-z]+\s+and\s+[A-Z][a-z]+/.test(line)
  const hasDOI = /doi\.org|DOI:/i.test(line)
  const hasURL = /http|www\./i.test(line)
  const hasVolume = /Vol\.|Volume|\b\d+\(\d+\)/.test(line)
  const hasPages = /pp\.|pages|[\d]+[-–]\d+/.test(line)
  const hasJournal = /Journal|Proceedings|Conference|Trans\.|Symposium/i.test(
    line
  )
  const hasCitation = /^\[\d+\]/.test(line) || /\(\d{4}\)/.test(line)

  const referenceIndicators = [
    hasYear,
    hasAuthors,
    hasDOI,
    hasURL,
    hasVolume,
    hasPages,
    hasJournal,
    hasCitation
  ].filter(Boolean).length

  // Include if it matches at least 2 patterns
  return referenceIndicators >= 2
}

// Function to check if a line is ambiguous
function isAmbiguous(line: string): boolean {
  // Include lines that aren't boilerplate but don't fully match reference patterns
  return line.trim().length > 30 && !isBoilerplateText(line)
}
