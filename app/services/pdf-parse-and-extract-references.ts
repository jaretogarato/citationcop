import type { Reference } from '@/app/types/reference'

export class PDFParseAndExtractReferenceService {
  private openAIEndpoint: string
  private parsePDFEndpoint: string

  constructor(openAIEndpoint: string, parsePDFEndpoint: string) {
    this.openAIEndpoint = openAIEndpoint
    this.parsePDFEndpoint = parsePDFEndpoint
  }

  /**
   * Parses the PDF and extracts references.
   * @param file The PDF file to process.
   * @returns The extracted references.
   */
  public async parseAndExtractReferences(file: File): Promise<Reference[]> {
    //console.log('*** Parsing PDF using the parse-pdf endpoint ***')

    // Prepare the file as binary data
    const formData = new FormData()
    formData.append('file', file)

    // Call the parse-pdf API endpoint
    const parseResponse = await fetch(this.parsePDFEndpoint, {
      method: 'POST',
      body: formData
    })

    if (!parseResponse.ok) {
      throw new Error(`Parsing API failed: ${parseResponse.statusText}`)
    }

    const { text: extractedText }: { text: string } = await parseResponse.json()
    //console.log('Extracted text from parse-pdf endpoint:', extractedText)

    // Send the extracted text to OpenAI for reference extraction
    //console.log('📤 Sending to OpenAI...')

    const response = await fetch(this.openAIEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: extractedText })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.statusText}`)
    }

    const { references }: { references: Reference[] } = await response.json()
    //console.log('📥 Received references from OpenAI:', references)

    
    return references
  }
}
