import type { Reference } from "../types/reference";

// Combine both validations
export const validateReferences = (references: Reference[]): Reference[] => {
    console.log('Validating references:', references);
    const validRefs = references.filter(isValidReference);
    return removeDuplicateReferences(validRefs);
};

const isValidReference = (reference: Reference): boolean => {
    const valid = Boolean(
        reference?.title?.trim() ||
        reference?.authors?.length > 0
    );
    if (!valid) {
        console.log('Invalid reference:', {
            title: reference?.title,
            authorCount: reference?.authors?.length,
            reference
        });
    }
    return valid;
};

const removeDuplicateReferences = (references: Reference[]): Reference[] => {
    const seen = new Set<string>();
    return references.filter(ref => {
        const normalizedTitle = ref.title?.toLowerCase().trim();
        if (seen.has(normalizedTitle)) {
            console.log('Duplicate found:', normalizedTitle);
            return false;
        }
        seen.add(normalizedTitle);
        return true;
    });
};