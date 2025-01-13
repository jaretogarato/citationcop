import type { Reference } from '@/app/types/reference'

// Helper function to check if two author lists are similar
const areAuthorsSimilar = (authors1: string[], authors2: string[]): boolean => {
  if (Math.abs(authors1.length - authors2.length) > 1) return false

  // Normalize author names and sort them
  const normalizeAndSort = (authors: string[]) =>
    authors.map((a) => a.toLowerCase().trim()).sort()

  const set1 = new Set(normalizeAndSort(authors1))
  const set2 = new Set(normalizeAndSort(authors2))

  // Count matching authors
  let matches = 0
  for (const author of set1) {
    if (set2.has(author)) matches++
  }

  // If at least 70% of authors match, consider them similar
  const threshold = Math.min(set1.size, set2.size) * 0.7
  return matches >= threshold
}

// Helper function to filter invalid references and remove duplicates
export const filterInvalidReferences = (
  references: Reference[]
): Reference[] => {


  console.log("references into filter: ", references)
  // First, filter out references without valid authors and titles
  const validRefs = references.filter((ref) => {
    const hasValidAuthors = Array.isArray(ref.authors) && ref.authors.length > 0
    const hasValidTitle =
      typeof ref.title === 'string' && ref.title.trim() !== ''
    return hasValidAuthors && hasValidTitle
  })

  // Then, remove duplicates while considering similar authors
  const uniqueRefs: Reference[] = []

  for (const ref of validRefs) {
    const normalizedTitle = ref.title.toLowerCase().trim()

    let isDuplicate = false
    for (const existingRef of uniqueRefs) {
      const existingTitle = existingRef.title.toLowerCase().trim()

      if (
        normalizedTitle === existingTitle &&
        areAuthorsSimilar(existingRef.authors, ref.authors)
      ) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      uniqueRefs.push(ref)
    }
  }


  console.log("references out filter: ", uniqueRefs)
  return uniqueRefs
}
