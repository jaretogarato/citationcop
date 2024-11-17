'use server'

import { Reference } from "@/types/reference"
import { fetchGoogleSearchResults } from "@/actions/serper-API"
import { verifyGoogleSearchResultWithLLM, verifyURL } from "@/actions/openAI-verify"

// Primary function to verify reference details
export async function verifyReference(reference: Reference): Promise<{ isValid: boolean, message: string, source?: string }> {
    
    // removing crossref verification because it is done in Grobid
    // here we add in the consolidate from Grobid?

    // 2. Verify via URL accessibility
    /*if (reference.url) {
        const urlResult = await verifyURL(reference)
        //console.log("URL Result:", urlResult);
        if (urlResult.isValid) {
            return { ...urlResult, source: "URL" };
        }
    }*/

    // 3. Fallback: Verify via Google Search
    const googleSearchResult = await verifyGoogleSearch(reference)

    if (googleSearchResult.isValid) {
        // Call LLM-based analysis for deeper verification on Google search results
        const llmResult = await verifyGoogleSearchResultWithLLM(reference, googleSearchResult.message)
        //if (llmResult.isValid) return llmResult;
        return { ...llmResult, source: "Google" }
    } else {
        //console.log("Google Search Result faild somehow!?:", googleSearchResult);
        //return { isValid: false, message: googleSearchResult.message };
        return { isValid: false, message: "Hmmm, web search failed. Can't confirm or not this reference." };
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
            includeUrl ? reference.url : null, // Only include URL if includeUrl is true
        ]
            .filter((field) => field !== null && field !== undefined)
            .join(" ")

        return fields
    }

    // Perform search and handle results
    const performSearch = async (query: string) => {
        try {
            //console.log("Google Search Query:", query);
            const searchResults = await fetchGoogleSearchResults(query);

            if (searchResults && searchResults.organic.length > 0) {
                const filteredResults = searchResults.organic.map(({ attributes, ...rest }: any) => rest);
                //console.log("Filtered Results:", filteredResults);
                return { success: true, results: filteredResults };
            }
            return { success: false, results: null };
        } catch (error) {
            console.error("VerifyGoogleSearch: Error in Google search verification:", error)
            return { success: false, results: null };
        }
    };

    // First attempt: Search with URL if it exists
    const initialQuery = buildQuery(true);
    const initialSearchResult = await performSearch(initialQuery);

    if (initialSearchResult.success) {
        return { isValid: true, message: initialSearchResult.results };
    }

    // Second attempt: If URL exists and first search failed, try without URL
    if (reference.url) {
        const queryWithoutUrl = buildQuery(false);
        const secondSearchResult = await performSearch(queryWithoutUrl);

        if (secondSearchResult.success) {
            return { isValid: true, message: secondSearchResult.results };
        }
    }

    return { isValid: false, message: "Google search verification failed." };
}