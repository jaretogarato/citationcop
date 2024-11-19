import type { Reference } from "../types/reference";

 // Combine both validations
 export const validateReferences = (references: Reference[]): Reference[] => {
    const validRefs = references.filter(isValidReference);
    return removeDuplicateReferences(validRefs);
  };

// Utility to check if a reference is valid (has required fields)
const isValidReference = (reference: Reference): boolean => {
    return Boolean(
      reference?.title?.trim() && 
      reference?.authors?.length > 0
    );
  };
  
  // Remove duplicates based on title similarity
  const removeDuplicateReferences = (references: Reference[]): Reference[] => {
    const seen = new Set<string>();
    return references.filter(ref => {
      const normalizedTitle = ref.title?.toLowerCase().trim();
      if (seen.has(normalizedTitle)) {
        return false;
      }
      seen.add(normalizedTitle);
      return true;
    });
  };
  
 