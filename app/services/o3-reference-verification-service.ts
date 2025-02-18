// o3-reference-verification-service.ts
import type { Reference } from '@/app/types/reference'

type ProcessStatus = 'pending' | 'complete' | 'error'

type ProcessState = {
  status: ProcessStatus
  messages?: any[]
  iteration?: number
  result?: any
  error?: string
  functionResult?: string
  lastToolCallId?: string
}

type VerifiedReference = {
  reference: Reference
  status: ProcessStatus
  result?: any
}

export class o3ReferenceVerificationService {
  private async checkDOI(doi: string, title: string) {
    const response = await fetch('/api/references/verify-doi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ references: [{ DOI: doi, title }] })
    })
    return await response.json()
  }

  private async searchReference(reference: string) {
    const response = await fetch('/api/references/verify-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })
    return await response.json()
  }

  private async checkURL(url: string, reference: string) {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    return await response.json()
  }

  public async verifyReference(
    reference: Reference,
    onUpdate?: (state: ProcessState) => void
  ): Promise<VerifiedReference> {
    let currentState: ProcessState = {
      status: 'pending',
      messages: [],
      iteration: 0
    }

    if (onUpdate) {
      onUpdate(currentState)
    }

    while (currentState.status === 'pending' && currentState.iteration! < 5) {
      const response = await fetch('/api/o3-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.raw || JSON.stringify(reference),
          iteration: currentState.iteration,
          previousMessages: currentState.messages,
          functionResult: currentState.functionResult,
          lastToolCallId: currentState.lastToolCallId
        })
      })

      const llmResponse = await response.json()

      if (llmResponse.functionToCall) {
        const { name, arguments: args } = llmResponse.functionToCall
        let functionResult

        switch (name) {
          case 'check_doi':
            functionResult = await this.checkDOI(args.doi, args.title)
            break
          case 'search_reference':
            functionResult = await this.searchReference(args.reference)
            break
          case 'check_url':
            functionResult = await this.checkURL(args.url, args.reference)
            break
        }

        currentState = {
          ...llmResponse,
          functionResult,
          lastToolCallId: llmResponse.lastToolCallId
        }
      } else {
        currentState = llmResponse
      }

      if (onUpdate) {
        onUpdate(currentState)
      }
    }

    console.log('fixed reference:', currentState.result.reference)
    // If process errors, update the reference's status to error
    // When process completes, get the LLM's verification status and message
    if (currentState.status === 'complete' && currentState.result) {
      // Update the original reference with verification result
      reference.status = currentState.result.status
      reference.message = currentState.result.message
      reference.fixedReference = currentState.result.reference
    } else if (currentState.status === 'error') {
      // Only set to error if process failed
      reference.status = 'error'
      reference.message = 'Hmm, something went wrong during verification'
    }

    return {
      reference,
      status: currentState.status,
      result: currentState.result
    }
  }

  public async processBatch(
    references: Reference[],
    onBatchProgress?: (verifiedReferences: VerifiedReference[]) => void
  ): Promise<VerifiedReference[]> {
    const verifiedReferences: VerifiedReference[] = []

    const batchSize = 5
    for (let i = 0; i < references.length; i += batchSize) {
      const batch = references.slice(i, i + batchSize)
      const batchPromises = batch.map((ref) =>
        this.verifyReference(ref, (state) => {
          console.log(
            `Verifying reference ${i + batch.indexOf(ref) + 1}/${references.length}`
          )
        })
      )

      const batchResults = await Promise.all(batchPromises)
      verifiedReferences.push(...batchResults)

      if (onBatchProgress) {
        onBatchProgress(verifiedReferences)
      }
    }

    return verifiedReferences
  }
}
