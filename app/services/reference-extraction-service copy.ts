import type { Reference } from '@/app/types/reference'
import { filterInvalidReferences } from '../utils/reference-helpers/filter-references'

export class ReferenceExtractionService {
  private openAIEndpoint: string

  constructor(openAIEndpoint: string) {
    this.openAIEndpoint = openAIEndpoint
  }

  public async extractReferences(text: string): Promise<Reference[]> {
    try {
      const response = await fetch(this.openAIEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.statusText}`)
      }

      const { references }: { references: Reference[] } = await response.json()
      //console.log('📥 Received references from OpenAI:', references)

      return filterInvalidReferences(references)
    } catch (error) {
      console.error('Error in extractReferences:', error)
      throw error
    }
  }
}