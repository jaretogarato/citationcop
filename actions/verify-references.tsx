'use server'

import { Reference } from "@/types/reference"
import { fetchGoogleSearchResults } from "@/actions/serper-API"
import { verifyGoogleSearchResultWithLLM, verifyURL } from "@/actions/openAI-verify"

// Primary function to verify reference details
export async function verifyReference(reference: Reference): Promise<{ isValid: boolean, message: string, source?: string }> {
    
    // removing crossref verification because it is done in Grobid

    // OPEN ALEX IS A PAY 2 PLAY API
    // 2. Verify via OpenAlex
    /* const openAlexResult = await verifyOpenAlex(reference);
     if (openAlexResult.isValid) return openAlexResult;*/

    // 4. Verify via Semantic Scholar
    //const semanticScholarResult = await verifySemanticScholar(reference);
    //if (semanticScholarResult.isValid) return semanticScholarResult;

    // 3. Verify via Open Library
    const openLibraryResult = await verifyOpenLibrary(reference);
    if (openLibraryResult.isValid) return openLibraryResult;

    // 4. Verify via URL accessibility
    if (reference.url) {
        const urlResult = await verifyURL(reference)
        console.log("URL Result:", urlResult);
        if (urlResult.isValid) {
            return { ...urlResult, source: "URL" };
        }
    }

    // Fallback: Verify via Google Search
    const googleSearchResult = await verifyGoogleSearch(reference)

    if (googleSearchResult.isValid) {
        // Call LLM-based analysis for deeper verification on Google search results
        const llmResult = await verifyGoogleSearchResultWithLLM(reference, googleSearchResult.message);
        //if (llmResult.isValid) return llmResult;
        return { ...llmResult, source: "Google" };
    } else {
        //console.log("Google Search Result faild somehow!?:", googleSearchResult);
        //return { isValid: false, message: googleSearchResult.message };
        return { isValid: false, message: "Couldn't find anything on the web on this one." };
    }


    // If all checks fail
    //return { isValid: false, message: "No valid verification found." };
}


// Types for OpenAlex API response
interface OpenAlexWork {
    id: string;
    title: string;
    publication_year?: number;
    doi?: string;
    type?: string;
    authorships?: Array<{
        author: {
            id: string;
            display_name: string;
        };
        institutions?: Array<{
            id: string;
            display_name: string;
        }>;
    }>;
}

interface OpenAlexResponse {
    meta: {
        count: number;
        db_response_time_ms: number;
        page: number;
        per_page: number;
    };
    results: OpenAlexWork[];
}

async function verifyOpenAlex(reference: Reference): Promise<{ isValid: boolean; message: string }> {
    if (!reference.title) {
        return { isValid: false, message: "No title provided for OpenAlex search." };
    }

    try {
        const titleQuery = encodeURIComponent(reference.title);
        const openAlexResponse = await fetch(`https://api.openalex.org/works?filter=title.search:${titleQuery}`);
        const openAlexData = await openAlexResponse.json() as OpenAlexResponse;


        //console.log("OpenAlex Data:", openAlexData.results);
        if (openAlexData.results && openAlexData.results.length > 0) {
            // Normalize the reference title for comparison
            const normalizedReferenceTitle = reference.title.toLowerCase().trim();

            // Look for an exact title match (case-insensitive)
            const matchedWork = openAlexData.results.find(work =>
                work.title?.toLowerCase().trim() === normalizedReferenceTitle
            );

            if (matchedWork) {
                return {
                    isValid: true,
                    message: `Verified via OpenAlex with exact title match.`
                };
            } else {
                return {
                    isValid: false,
                    message: "No exact title match found in OpenAlex results."
                };
            }
        }
    } catch (error) {
        console.error("Error verifying reference with OpenAlex:", error);
    }

    return { isValid: false, message: "OpenAlex verification failed." };
}

// Verification using Semantic Scholar API
/*async function verifySemanticScholar(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    if (!reference.title) {
        return { isValid: false, message: "No title provided for Semantic Scholar search." };
    }
    try {
        const titleQuery = encodeURIComponent(reference.title);
        const semanticScholarResponse = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${titleQuery}`);
        const semanticScholarData = await semanticScholarResponse.json();

        // Check if the response contains data and match the title
        if (semanticScholarData.data && semanticScholarData.data.length > 0) {
            // Normalize the title for comparison (case-insensitive and trimmed)
            const referenceTitle = reference.title.toLowerCase().trim();

            // Check if any result has a title matching the reference title
            const matchedPaper = semanticScholarData.data.find((paper: any) =>
                paper.title && paper.title.toLowerCase().trim() === referenceTitle
            );

            if (matchedPaper) {
                return { isValid: true, message: `Verified via Semantic Scholar: ${matchedPaper.title}` };
            } else {
                return { isValid: false, message: "No exact title match found on Semantic Scholar." };
            }
        }
    } catch (error) {
        console.error("Error verifying reference with Semantic Scholar:", error);
    }
    return { isValid: false, message: "Semantic Scholar verification failed." };
}*/


// Verification using Open Library API
async function verifyOpenLibrary(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    if (!reference.title) return { isValid: false, message: "No title provided for Open Library search." };
    try {
        const titleQuery = encodeURIComponent(reference.title);
        const openLibraryResponse = await fetch(`https://openlibrary.org/search.json?title=${titleQuery}`);
        const openLibraryData = await openLibraryResponse.json();
        if (openLibraryData.docs && openLibraryData.docs.length > 0) {
            return { isValid: true, message: "Verified via Open Library." };
        }
    } catch (error) {
        console.error("Error verifying reference with Open Library:", error);
    }
    return { isValid: false, message: "Open Library verification failed." };
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
            .join(" ");

        return fields;
    };

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
            console.error("VerifyGoogleSearch: Error in Google search verification:", error);
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