import { Reference, ReferenceStatus } from "@/types/reference"
import { fetchGoogleSearchResults } from "@/actions/serper-API"

const GOOGLE_BATCH_SIZE = 10;  // Can be adjusted if we hit rate limits
const OPENAI_BATCH_SIZE = 3;
const OPENAI_CONCURRENT_LIMIT = 3;  // Matching your 3 API keys


async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let currentKeyIndex = 0;
function getNextKeyIndex() {
    const index = currentKeyIndex;
    currentKeyIndex = (currentKeyIndex + 1) % 3;
    return index;
}

async function batchGoogleSearches(
    references: Reference[], 
    onProgress?: (count: number) => void
): Promise<Map<string, { isValid: boolean, message: any }>> {
    const results = new Map();
    const startTime = Date.now();
    let currentBatchSize = GOOGLE_BATCH_SIZE;

    // Process in batches
    for (let i = 0; i < references.length; i += currentBatchSize) {
        const batch = references.slice(i, i + currentBatchSize);
        console.log(`Processing Google search batch ${i / currentBatchSize + 1}, size: ${batch.length}`);

        try {
            const searchPromises = batch.map(reference =>
                verifyGoogleSearch(reference)
                    .then(result => {
                        if (result.isValid) {
                            // Make sure to store the ID as a string
                            results.set(reference.id.toString(), result);
                        }
                        return { reference, result };
                    })
                    .catch(error => {
                        if (error.message?.includes('429')) {
                            currentBatchSize = Math.max(Math.floor(currentBatchSize / 2), 1);
                            console.warn(`Rate limit hit, reducing batch size to ${currentBatchSize}`);
                        }
                        return { reference, error };
                    })
            );

            const batchResults = await Promise.all(searchPromises);
            onProgress?.(i + batchResults.length);

            await Promise.all(searchPromises);

            // Small delay between batches
            if (i + currentBatchSize < references.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error('Batch processing error:', error);
        }
    }

    console.log(`All Google searches completed in ${Date.now() - startTime}ms`);
    console.log(`Valid results found: ${results.size}`);
    return results;
}

async function batchOpenAIVerification(
    references: Reference[], 
    googleResults: Map<string, { isValid: boolean, message: any }>,
    onProgress?: (count: number) => void
): Promise<Reference[]> {
    const verifiedRefs: Reference[] = [];
    const startTime = Date.now();

    // Filter references that need OpenAI verification
    const refsToVerify = references.filter(ref => 
        googleResults.get(ref.id.toString())?.isValid === true
    );

    console.log(`Starting OpenAI verification for ${refsToVerify.length} references`);

    // Process in batches of 3
    for (let i = 0; i < refsToVerify.length; i += OPENAI_BATCH_SIZE) {
        const batch = refsToVerify.slice(i, i + OPENAI_BATCH_SIZE);
        console.log(`Processing OpenAI batch ${i / OPENAI_BATCH_SIZE + 1}, size: ${batch.length}`);

        const verificationPromises = batch.map(reference => {
            const googleResult = googleResults.get(reference.id.toString());
            if (!googleResult?.isValid) {
                return Promise.resolve({
                    ...reference,
                    status: 'unverified' as ReferenceStatus,
                    message: "Failed Google search verification",
                    verification_source: "Google"
                });
            }

            return verifyWithOpenAI(reference, googleResult.message, { keyIndex: getNextKeyIndex(), maxRetries: 1 })
                .then(llmResult => ({
                    ...reference,
                    status: llmResult.isValid ? 'verified' : 'unverified' as ReferenceStatus,
                    message: llmResult.message,
                    verification_source: "Google+OpenAI"
                }))
                .catch(error => ({
                    ...reference,
                    status: 'error' as ReferenceStatus,
                    message: "Verification service temporarily unavailable",
                    verification_source: "Error"
                }));
        });

        const batchResults = await Promise.all(verificationPromises);
        verifiedRefs.push(...batchResults);
        onProgress?.(i + batchResults.length);
    }

    // Handle references that didn't pass Google verification
    const failedGoogleRefs = references.filter(ref => 
        !googleResults.get(ref.id.toString())?.isValid
    ).map(ref => ({
        ...ref,
        status: 'unverified' as ReferenceStatus,
        message: "Failed Google search verification",
        verification_source: "Google"
    }));

    verifiedRefs.push(...failedGoogleRefs);

    console.log(`All OpenAI verifications completed in ${Date.now() - startTime}ms`);
    return verifiedRefs;
}

export async function verifyReferences(
  references: Reference[],
  onProgress?: (stage: 'google' | 'openai', count: number) => void
): Promise<Reference[]> {
  // First stage: Google search verification
  console.log('Starting Google search verification');
  const googleResults = new Map<string, { isValid: boolean; message: any }>();
  
  // Process Google searches in batches
  for (let i = 0; i < references.length; i += GOOGLE_BATCH_SIZE) {
    const batch = references.slice(i, i + GOOGLE_BATCH_SIZE);
    try {
      const results = await batchGoogleSearches(batch);
      results.forEach((result, id) => googleResults.set(id, result));
      onProgress?.('google', i + batch.length);
    } catch (error) {
      console.error('Google batch error:', error);
      // Mark failed batch as unverified
      batch.forEach(ref => {
        googleResults.set(ref.id.toString(), {
          isValid: false,
          message: 'Google search verification failed'
        });
      });
    }
  }

  // Second stage: OpenAI verification
  console.log('Starting OpenAI verification');
  const refsToVerify = references.filter(ref => 
    googleResults.get(ref.id.toString())?.isValid
  );

  // Process OpenAI verifications in parallel batches of 3
  const verifiedRefs: Reference[] = [];
  for (let i = 0; i < refsToVerify.length; i += OPENAI_CONCURRENT_LIMIT) {
    const batch = refsToVerify.slice(i, i + OPENAI_CONCURRENT_LIMIT);
    
    // Process each reference in the batch with a different API key
    const verificationPromises = batch.map((ref, index) => 
      verifyWithOpenAI(ref, googleResults.get(ref.id.toString())?.message, {
        keyIndex: index,
        maxRetries: 1  // The endpoint handles retries internally
      })
    );

    try {
      const results = await Promise.all(verificationPromises);
      verifiedRefs.push(...results.map((result, index) => ({
        ...batch[index],
        status: result.isValid ? 'verified' : 'unverified' as ReferenceStatus,
        message: result.message,
        verification_source: 'Google+OpenAI'
      })));
      onProgress?.('openai', i + batch.length);
    } catch (error) {
      console.error('OpenAI batch error:', error);
      // Handle failed verifications
      verifiedRefs.push(...batch.map(ref => ({
        ...ref,
        status: 'error' as ReferenceStatus,
        message: 'OpenAI verification failed',
        verification_source: 'Error'
      })));
    }
  }

  // Handle references that failed Google verification
  const failedGoogleRefs = references.filter(ref => 
    !googleResults.get(ref.id.toString())?.isValid
  ).map(ref => ({
    ...ref,
    status: 'unverified' as ReferenceStatus,
    message: googleResults.get(ref.id.toString())?.message || 'Failed Google search verification',
    verification_source: 'Google'
  }));

  return [...verifiedRefs, ...failedGoogleRefs];
}

async function verifyWithOpenAI(
  reference: Reference, 
  searchResults: any,
  options: { keyIndex: number; maxRetries: number }
): Promise<{ isValid: boolean; message: string }> {
  try {
    const response = await fetch('/api/references/openAI-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference,
        searchResults,
        keyIndex: options.keyIndex,
        maxRetries: options.maxRetries
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('OpenAI verification error:', error);
    throw error;
  }
}




async function verifyGoogleSearch(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    // Function to build query string from reference
    const buildQuery = (includeUrl: boolean) => {
        const fields = [
            reference.authors?.join(" "),
            reference.title,
            reference.journal,
            reference.year,
            reference.volume,
            reference.pages,
            reference.publisher,
            reference.conference,
            includeUrl ? reference.url : null,
        ]
            .filter((field) => field !== null && field !== undefined)
            .join(" ")

        return fields
    }

    const performSearch = async (query: string) => {
        console.log("🔍 Starting Google search for query:", query.slice(0, 50) + "...");

        try {
            const searchResults = await fetchGoogleSearchResults(query);
            console.log("✅ Search completed for query:", query.slice(0, 50) + "...");
            if (searchResults && searchResults.organic.length > 0) {
                const filteredResults = searchResults.organic.map(({ attributes, ...rest }: any) => rest);
                return { success: true, results: filteredResults };
            }
            return { success: false, results: null };
        } catch (error) {
            console.error("VerifyGoogleSearch: Error in Google search verification:", error)
            return { success: false, results: null };
        }
    };

    const initialQuery = buildQuery(true);
    const initialSearchResult = await performSearch(initialQuery);

    if (initialSearchResult.success) {
        return { isValid: true, message: initialSearchResult.results };
    }

    if (reference.url) {
        const queryWithoutUrl = buildQuery(false);
        const secondSearchResult = await performSearch(queryWithoutUrl);

        if (secondSearchResult.success) {
            return { isValid: true, message: secondSearchResult.results };
        }
    }

    return { isValid: false, message: "Google search verification failed." };
}