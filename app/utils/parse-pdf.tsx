export const cleanText = (text: string): string => {
  return (
    text
      // Remove non-printable characters (e.g., control characters)
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Remove excessive whitespace
      .replace(/\s{2,}/g, ' ')
      // Replace multiple line breaks with a single one
      .replace(/\n\s*\n/g, '\n')
      .trim()
  )
}
