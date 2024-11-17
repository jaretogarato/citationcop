// utils/reference-utils.ts
import { useRef, useCallback, useState } from 'react';
import { Reference, ReferenceStatus } from '@/types/reference';
import { verifyReferences } from '@/utils/verify-helpers/verify-references';
import type { VerificationResults } from '@/types/reference';

// utils/verify-helpers/reference-utils.ts
export async function verifyReferenceAndUpdateStatus(
  references: Reference[],
  onProgress: (stage: 'google' | 'openai', count: number, updatedRefs: Reference[]) => void
): Promise<Reference[]> {
  try {
    const verifiedRefs = await verifyReferences(references, onProgress);
    
    return verifiedRefs.map(ref => ({
      ...ref,
      status: ref.status as ReferenceStatus,
      verification_source: ref.verification_source,
      message: ref.message
    }));
  } catch (error) {
    console.error('Error in reference verification:', error);
    return references.map(ref => ({
      ...ref,
      status: 'error' as ReferenceStatus,
      verification_source: 'error',
      message: error instanceof Error ? error.message : 'Verification process failed'
    }));
  }
}