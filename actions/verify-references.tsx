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
   // const urlResult = await verifyURL(reference);
   // if (urlResult.isValid) return urlResult;

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
    if (googleSearchResult.isValid) {
        // Call LLM-based analysis for deeper verification on Google search results
        const llmResult = await verifyGoogleSearchResultWithLLM(reference, googleSearchResult.message);
        //if (llmResult.isValid) return llmResult;
        return { ...llmResult, source: "Google" };
    }


    // If all checks fail
    return { isValid: false, message: "No valid verification found." };
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

// Verification using URL accessibility check
async function verifyURL(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    if (!reference.url) return { isValid: false, message: "No URL provided." };
    try {
        const response = await fetch(reference.url, { method: "HEAD" });
        if (response.ok) {
            return { isValid: true, message: "URL is accessible." };
        } else {
            return { isValid: false, message: "URL is inaccessible or broken." };
        }
    } catch (error) {
        console.error("Error verifying URL:", error);
        return { isValid: false, message: "Error accessing URL." };
    }
}

// ** NEED TO ADD MATCH CHECK FOR THE TITLE JUST BECAUSE IT RECEIVES THE RESULTS ISN"T SUFFICIENT
// Verification using OpenAlex API
async function verifyOpenAlex(reference: Reference): Promise<{ isValid: boolean, message: string }> {
    if (!reference.title) return { isValid: false, message: "No title provided for OpenAlex search." };
    try {
        const titleQuery = encodeURIComponent(reference.title);
        const openAlexResponse = await fetch(`https://api.openalex.org/works?filter=title.search:${titleQuery}`);
        const openAlexData = await openAlexResponse.json();
        
        // check that there is a match of the titles
        //TODO: check if the title is in the results
        
        
        if (openAlexData.results && openAlexData.results.length > 0) {
            return { isValid: true, message: "Verified via OpenAlex." };
        }
    } catch (error) {
        console.error("Error verifying reference with OpenAlex:", error);
    }
    return { isValid: false, message: "OpenAlex verification failed." };
}

// Verification using Semantic Scholar API
async function verifySemanticScholar(reference: Reference): Promise<{ isValid: boolean, message: string }> {
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
}


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
    // Build a search query from available fields in the reference
    const query = [
        reference.authors?.join(" "), // Join author array into a single string if not null
        reference.title,
        reference.journal,
        reference.year,
        reference.volume,
        reference.pages,
        reference.DOI,
        reference.publisher,
        reference.conference,
        reference.url,
        reference.date_of_access,
        reference.issue,
    ]
        .filter((field) => field !== null && field !== undefined) // Only include non-null and defined fields
        .join(" ");

    // Perform Google search using server-side action
    try {
        const searchResults = await fetchGoogleSearchResults(query);
        // Check if results match (for now, simply returning that results were found)
        //console.log("Google Search Results:", searchResults.organic);
        
        if (searchResults && searchResults.organic.length > 0) {

            const filteredResults = searchResults.organic.map(({ attributes, ...rest }: any) => rest);
            console.log("Filtered Results:", filteredResults);
            return { isValid: true, message: filteredResults};
        }
    } catch (error) {
        console.error("VerifyGoogleSearch: Error in Google search verification:", error);
    }
    return { isValid: false, message: "Google search verification failed." };
}