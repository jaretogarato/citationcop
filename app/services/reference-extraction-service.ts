//import { PDFDocumentProxy } from 'pdfjs-dist'

interface PDFLine {
  x: number
  y: number
  width: number
  height: number
  text: string
  _height: number[]
}

interface ProcessedPage {
  pageNumber: number
  imageData: string
  parsedContent: {
    lines: PDFLine[]
  }
}

interface ExtractedReference {
  text: string
  confidence: number
  pageNumber: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export class EnhancedReferenceExtractor {
  /**
   * Main method to extract references using both OCR and parsed text
   */
  async extractReferences(pages: ProcessedPage[]): Promise<ExtractedReference[]> {
    const allReferences: ExtractedReference[] = []

    for (const page of pages) {
      // Get references from OCR
      const ocrReferences = await this.extractFromOCR(page.imageData, page.pageNumber)
      
      // Get references from parsed text
      const parsedReferences = this.extractFromParsedText(page.parsedContent.lines, page.pageNumber)
      
      // Merge and deduplicate references
      const mergedReferences = await this.mergeReferences(ocrReferences, parsedReferences)
      allReferences.push(...mergedReferences)
    }

    return this.postProcessReferences(allReferences)
  }

  /**
   * Extract references using OCR (Llama Vision)
   */
  private async extractFromOCR(imageData: string, pageNumber: number): Promise<ExtractedReference[]> {
    const response = await fetch('/api/llama-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: imageData,
        mode: 'free'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to extract references using OCR')
    }

    const { markdown } = await response.json()
    
    // Split markdown into potential references
    const references = this.splitMarkdownIntoReferences(markdown)
    
    return references.map(ref => ({
      text: ref,
      confidence: 0.8, // Base confidence for OCR
      pageNumber
    }))
  }

  /**
   * Extract references from parsed PDF text
   */
  private extractFromParsedText(lines: PDFLine[], pageNumber: number): ExtractedReference[] {
    const references: ExtractedReference[] = []
    let currentReference = ''
    let currentBoundingBox: ExtractedReference['boundingBox'] | undefined

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]
      
      // Check if this line starts a new reference
      const isNewReference = this.isReferenceStart(line.text)
      
      if (isNewReference && currentReference) {
        // Save the previous reference
        references.push({
          text: currentReference.trim(),
          confidence: 0.9, // Higher confidence for parsed text
          pageNumber,
          boundingBox: currentBoundingBox
        })
        currentReference = ''
        currentBoundingBox = undefined
      }

      // Update current reference
      currentReference += (currentReference ? ' ' : '') + line.text

      // Update bounding box
      if (!currentBoundingBox) {
        currentBoundingBox = {
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height
        }
      } else {
        currentBoundingBox.height = Math.max(
          currentBoundingBox.y + currentBoundingBox.height,
          line.y + line.height
        ) - currentBoundingBox.y
        currentBoundingBox.width = Math.max(
          currentBoundingBox.width,
          line.width
        )
      }

      // Check if this is the end of a reference
      const isEndOfReference = 
        !nextLine || 
        this.isReferenceStart(nextLine.text) ||
        this.isLikelyNewSection(nextLine.text)

      if (isEndOfReference && currentReference) {
        references.push({
          text: currentReference.trim(),
          confidence: 0.9,
          pageNumber,
          boundingBox: currentBoundingBox
        })
        currentReference = ''
        currentBoundingBox = undefined
      }
    }

    return references
  }

  /**
   * Merge references from OCR and parsed text
   */
  private async mergeReferences(
    ocrRefs: ExtractedReference[],
    parsedRefs: ExtractedReference[]
  ): Promise<ExtractedReference[]> {
    const merged: ExtractedReference[] = []
    
    // First, try to match references between OCR and parsed text
    for (const ocrRef of ocrRefs) {
      const bestMatch = this.findBestMatch(ocrRef, parsedRefs)
      
      if (bestMatch) {
        // Combine the information from both sources
        merged.push({
          text: bestMatch.similarity > 0.9 ? bestMatch.ref.text : ocrRef.text,
          confidence: Math.max(ocrRef.confidence, bestMatch.ref.confidence),
          pageNumber: ocrRef.pageNumber,
          boundingBox: bestMatch.ref.boundingBox
        })
      } else {
        // No match found, keep the OCR reference
        merged.push(ocrRef)
      }
    }
    
    // Add any parsed references that weren't matched
    for (const parsedRef of parsedRefs) {
      if (!this.hasCloseMatch(parsedRef, merged)) {
        merged.push(parsedRef)
      }
    }
    
    return merged
  }

  /**
   * Post-process and clean up the extracted references
   */
  private postProcessReferences(references: ExtractedReference[]): ExtractedReference[] {
    return references
      .map(ref => ({
        ...ref,
        text: this.cleanReferenceText(ref.text)
      }))
      .filter(ref => this.isValidReference(ref.text))
      .sort((a, b) => {
        // Sort by page number first
        if (a.pageNumber !== b.pageNumber) {
          return a.pageNumber - b.pageNumber
        }
        // Then by vertical position if available
        if (a.boundingBox && b.boundingBox) {
          return a.boundingBox.y - b.boundingBox.y
        }
        return 0
      })
  }

  /**
   * Helper methods for reference text processing
   */
  private splitMarkdownIntoReferences(markdown: string): string[] {
    // Split on common reference patterns
    return markdown
      .split(/\n(?=\[\d+\]|\d+\.\s|[A-Z][a-z]+,\s+[A-Z]\.|\[.*?\]\s+\()/g)
      .map(ref => ref.trim())
      .filter(ref => ref.length > 0)
  }

  private isReferenceStart(text: string): boolean {
    // Common reference start patterns
    const patterns = [
      /^\[\d+\]/, // [1]
      /^\d+\.\s/, // 1.
      /^[A-Z][a-z]+,\s+[A-Z]\./, // Smith, J.
      /^\[.*?\]\s+\(/ // [Smith2023] (
    ]
    return patterns.some(pattern => pattern.test(text.trim()))
  }

  private isLikelyNewSection(text: string): boolean {
    // Common section header patterns
    const patterns = [
      /^(?:\d+\.?\s*)?[A-Z][A-Z\s]+(?:\s+\d+)?$/,  // All caps sections
      /^(?:\d+\.?\s*)?[A-Z][a-z]+(?:\s+\d+)?$/,    // Capitalized words
      /^Appendix|Acknowledgments|Notes|Discussion|Conclusion/i // Common section names
    ]
    return patterns.some(pattern => pattern.test(text.trim()))
  }

  private cleanReferenceText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[""]/g, '"') // Normalize quotes
      .trim()
  }

  private isValidReference(text: string): boolean {
    // Basic validation of reference text
    return (
      text.length > 10 && // Minimum length
      /[A-Z]/.test(text) && // Contains capital letters
      /\d/.test(text) && // Contains numbers (likely a year)
      !/^(Figure|Table|Section)\s/i.test(text) // Not a figure/table reference
    )
  }

  private findBestMatch(
    ref: ExtractedReference,
    candidates: ExtractedReference[]
  ): { ref: ExtractedReference; similarity: number } | null {
    let bestMatch = null
    let bestSimilarity = 0

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(ref.text, candidate.text)
      if (similarity > bestSimilarity && similarity > 0.6) {
        bestMatch = candidate
        bestSimilarity = similarity
      }
    }

    return bestMatch ? { ref: bestMatch, similarity: bestSimilarity } : null
  }

  private hasCloseMatch(ref: ExtractedReference, candidates: ExtractedReference[]): boolean {
    return candidates.some(candidate => 
      this.calculateSimilarity(ref.text, candidate.text) > 0.8
    )
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Levenshtein-based similarity
    const maxLength = Math.max(text1.length, text2.length)
    if (maxLength === 0) return 1.0
    
    const distance = this.levenshteinDistance(text1, text2)
    return 1 - distance / maxLength
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          )
        }
      }
    }

    return dp[m][n]
  }
}