'use server'

import { Reference } from "@/types/reference"
import { fetchGoogleSearchResults } from "@/actions/serper-API"
import { verifyGoogleSearchResultWithLLM } from "@/actions/openAI-verify"

// Primary function to verify reference details
export async function verifyReference(reference: Reference): Promise<{ isValid: boolean, message: string, source?: string }> {
    // 1. Verify via CrossRef (with fuzzy matching)
    const crossRefResult = await verifyCrossRef(reference);
    if (crossRefResult.isValid) return crossRefResult;

    // 2. Verify via URL accessibility
    const urlResult = await verifyURL(reference);
    if (urlResult.isValid) {
        return { ...urlResult, source: "URL" };
    }

    // 3. Verify via OpenAlex
    const openAlexResult = await verifyOpenAlex(reference);
    if (openAlexResult.isValid) return openAlexResult;

    // 4. Verify via Semantic Scholar
    //const semanticScholarResult = await verifySemanticScholar(reference);
    //if (semanticScholarResult.isValid) return semanticScholarResult;

    // 5. Verify via Open Library
    const openLibraryResult = await verifyOpenLibrary(reference);
    if (openLibraryResult.isValid) return openLibraryResult;

    // 6. Fallback: Verify via Google Search
    const googleSearchResult = await verifyGoogleSearch(reference)

    console.log("Google Search Result:", googleSearchResult);

    if (googleSearchResult.isValid) {
        // Call LLM-based analysis for deeper verification on Google search results
        const llmResult = await verifyGoogleSearchResultWithLLM(reference, googleSearchResult.message);
        //if (llmResult.isValid) return llmResult;
        return { ...llmResult, source: "Google" };
    } else {
        console.log("Google Search Result faild somehow!?:", googleSearchResult);
        //return { isValid: false, message: googleSearchResult.message };
        return { isValid: false, message: "Couldn't find anything on the web on this one." };
    }


    // If all checks fail
    //return { isValid: false, message: "No valid verification found." };
}

// Verification using CrossRef API (DOI check with fuzzy title matching)
async function verifyCrossRef(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    if (!reference.DOI) return { isValid: false, message: "No DOI provided." };
    try {
        const crossRefResponse = await fetch(`https://api.crossref.org/works/${reference.DOI}`);
        const crossRefData = await crossRefResponse.json();
        const titleFromAPI = crossRefData.message?.title?.[0]?.toLowerCase();
        const referenceTitle = reference.title?.toLowerCase();

        // Perform a fuzzy match by checking title similarity
        if (titleFromAPI && referenceTitle && titleFromAPI.includes(referenceTitle)) {
            return { isValid: true, message: "Verified via CrossRef with DOI and fuzzy match on title." };
        }
    } catch (error) {
        console.error("Error verifying DOI with CrossRef:", error);
    }
    return { isValid: false, message: "CrossRef verification failed." };
}

async function verifyURL(reference: Reference): Promise<{ isValid: boolean; message: string }> {
    if (!reference.url) return { isValid: false, message: "No URL provided." };

    try {
        // Fetch the full page content instead of just doing a HEAD request
        const response = await fetch(reference.url);
        if (!response.ok) {
            return { isValid: false, message: "URL is inaccessible or broken." };
        }

        // Get the text content of the page and clean it
        const htmlContent = await response.text();
        const cleanContent = extractTextContent(htmlContent).toLowerCase();

        // Perform verification checks on the cleaned content
        const checks = {
            title: reference.title ? cleanContent.includes(reference.title.toLowerCase()) : true,
            authors: reference.authors ? reference.authors.some(author =>
                cleanContent.includes(author.toLowerCase())
            ) : true,
            year: reference.year ? cleanContent.includes(reference.year.toString()) : true
        };

        // Calculate confidence score (0-1)
        const totalChecks = Object.values(checks).length;
        const passedChecks = Object.values(checks).filter(Boolean).length;
        const confidence = passedChecks / totalChecks;

        // Build detailed verification message
        const details = [];
        if (!checks.title) details.push("title not found");
        if (!checks.authors) details.push("authors not found");
        if (!checks.year) details.push("year not found");

        if (confidence >= 0.7) {
            return {
                isValid: true,
                message: `URL verified with ${(confidence * 100).toFixed(1)}% confidence`
            };
        } else {
            return {
                isValid: false,
                message: `URL content verification failed: ${details.join(", ")}`
            };
        }

    } catch (error) {
        console.error("Error verifying URL:", error);
        return { isValid: false, message: `Error accessing URL: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

// Helper function to extract text content from HTML
function extractTextContent(html: string): string {
    // Remove script and style elements
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags and decode entities
    return html.replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
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
            console.log("Google Search Query:", query);
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