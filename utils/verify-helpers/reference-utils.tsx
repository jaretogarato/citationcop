// utils/reference-utils.ts
import { Reference, ReferenceStatus } from '@/types/reference';
import { verifyReference } from '@/utils/verify-helpers/verify-references';

export async function verifyReferenceAndUpdateStatus(reference: Reference): Promise<Reference> {
  try {
    const result = await verifyReference(reference);
    
    // Map the verification result to our Reference status
    const status: ReferenceStatus = result.isValid ? 'verified' : 
                                  result.message.includes('failed') ? 'error' : 
                                  'unverified';

    return {
      ...reference,
      status,
      verification_source: result.source || 'automated-check',
      message: result.message
    };
  } catch (error) {
    console.error('Error in reference verification:', error);
    return {
      ...reference,
      status: 'error' as ReferenceStatus,
      verification_source: 'error',
      message: error instanceof Error ? error.message : 'Verification process failed'
    };
  }
}