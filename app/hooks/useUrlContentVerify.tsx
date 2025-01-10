'use client'

import { useState, useCallback } from 'react'
import type {
  Reference,
  ReferenceStatus,
  UrlVerificationResult
} from '@/app/types/reference'

export interface UseUrlContentVerifyResult {
  processFailedReferences: (references: Reference[]) => Promise<Reference[]>
  urlVerifiedRefs: Reference[]
}

export function useUrlContentVerify(): UseUrlContentVerifyResult {
  const [urlVerifiedRefs, setUrlVerifiedRefs] = useState<Reference[]>([])

  const verifyUrlContent = async (reference: Reference): Promise<Reference> => {
    if (!reference.url) {
      return reference
    }

    try {
      const response = await fetch('/api/references/url-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reference,
          maxRetries: 2
        })
      })

      if (!response.ok) {
        throw new Error('Failed to verify URL content')
      }

      const result = (await response.json()) as UrlVerificationResult

      // If URL verification was successful, update the reference with new message
      if (result.status === 'verified') {
        return {
          ...reference,
          status: 'verified' as ReferenceStatus,
          message: result.message, // Update message with URL verification result
          url_match: true
        }
      } else {
        // For error or invalid status, keep original message but mark url_match as false
        return {
          ...reference,
          url_match: false
        }
      }
    } catch (error) {
      console.error('Error verifying URL content:', error)
      return {
        ...reference,
        url_match: false
      }
    }
  }

  const processFailedReferences = useCallback(
    async (references: Reference[]): Promise<Reference[]> => {
      // Filter references that failed initial verification and have URLs
      const failedRefs = references.filter(
        (ref) =>
          (ref.status === 'error' || ref.status === 'unverified') && ref.url
      )

      if (failedRefs.length === 0) {
        return references
      }

      console.log(
        `Attempting URL verification for ${failedRefs.length} failed references`
      )

      // Process all references, but only attempt URL verification for failed ones
      const results = await Promise.all(
        references.map(async (ref) => {
          if (
            (ref.status === 'error' || ref.status === 'unverified') &&
            ref.url
          ) {
            return await verifyUrlContent(ref)
          }
          return ref
        })
      )

      setUrlVerifiedRefs(results)
      return results
    },
    []
  )

  return {
    processFailedReferences,
    urlVerifiedRefs
  }
}
