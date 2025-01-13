import type { Reference } from '@/app/types/reference'

/**
 * Utility function to log references with detailed search results.
 * @param references Array of references to log.
 */
export const logReferences = (references: Reference[]): void => {
  console.log('🔍 References:')
  references.forEach((reference, index) => {
    console.log(`** Reference #${index + 1}:`)
    console.log(`  Title: ${reference.title}`)
    console.log(`  Authors: ${reference.authors.join(', ')}`)
    console.log(`  Status: ${reference.status}`)
    console.log(`  Verification Source: ${reference.verification_source}`)
    console.log(`  Message: ${reference.message}`)
    //console.log(`  Search Results:`)

   /* if (reference.searchResults?.organic?.length) {
      reference.searchResults.organic.forEach((result, i) => {
        console.log(`    Result #${i + 1}:`)
        console.log(`      Title: ${result.title}`)
        console.log(`      Link: ${result.link}`)
        console.log(`      Snippet: ${result.snippet}`)
      })
    } else {
      //console.log('    No organic search results found.')
    }*/

    //console.log('---')
  })
}
