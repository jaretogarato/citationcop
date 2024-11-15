'use server'

import { Reference } from "@/types/reference"
import { fetchGoogleSearchResults } from "@/actions/serper-API"
import { verifyGoogleSearchResultWithLLM, verifyURL } from "@/actions/openAI-verify"

// Primary function to verify reference details
export async function verifyReference(reference: Reference): Promise<{ isValid: boolean, message: string, source?: string }> {
    // 1. Verify via CrossRef (with fuzzy matching)
    const crossRefResult = await verifyCrossRefDOI(reference);
    if (crossRefResult.isValid) return crossRefResult;

    // 2. Verify via CrossRef metadata search
    const crossRefSearchResult = await verifyCrossRef(reference);
    if (crossRefSearchResult.isValid) return crossRefSearchResult;

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

// Verification using CrossRef API (DOI check with fuzzy title matching)
async function verifyCrossRefDOI(reference: Reference): Promise<{ isValid: boolean, message: string }> {
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


async function verifyCrossRef(reference: Reference): Promise<{ isValid: boolean; message: string; source?: string }> {
    if (!reference.title && !reference.authors?.length) {
        return {
            isValid: false,
            message: "Need at least title or authors to search",
        };
    }

    try {
        // Build the query parameters
        const queryParts: string[] = [];

        if (reference.title) {
            queryParts.push(`query.bibliographic=${encodeURIComponent(reference.title)}`);
        }

        if (reference.authors?.[0]) {
            // Take first author for initial search
            queryParts.push(`query.author=${encodeURIComponent(reference.authors[0])}`);
        }

        if (reference.journal) {
            queryParts.push(`query.container-title=${encodeURIComponent(reference.journal)}`);
        }

        /*if (reference.year) {
            queryParts.push(`filter=from-pub-date:${reference.year},until-pub-date:${reference.year}`);
        }*/

        // Add other useful parameters
        queryParts.push('rows=5'); // Limit results
        queryParts.push('select=DOI,title,author,published-print,container-title,volume,issue');

        const url = `https://api.crossref.org/works?${queryParts.join('&')}`;

        console.log("CrossRef URL:", url);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Your-App-Name (mailto:your-email@example.com)'
            }
        });

        if (!response.ok) {
            return {
                isValid: false,
                message: `CrossRef API error: ${response.status}`,
            };
        }

        const data = await response.json();
        const works = data.message.items;

        if (works.length === 0) {
            return {
                isValid: false,
                message: "No matching references found",
            };
        }

        // Score each result
        const scoredWorks = works.map((work: any) => {
            let score = 0;
            const matchDetails: string[] = [];

            // Title comparison (highest weight)
            if (reference.title && work.title?.[0]) {
                const titleFromAPI = work.title[0].toLowerCase();
                const refTitle = reference.title.toLowerCase();
                if (titleFromAPI.includes(refTitle) || refTitle.includes(titleFromAPI)) {
                    score += 0.3;
                    matchDetails.push("title matched");
                }
            }

            // Author comparison
            if (reference.authors?.length && work.author?.length) {
                const apiAuthors = work.author.map((a: any) =>
                    `${a.family}${a.given ? ` ${a.given}` : ''}`.toLowerCase()
                );
                const refAuthors = reference.authors.map(a => a.toLowerCase());

                const authorMatches: string[] = refAuthors.filter((refAuthor: string) =>
                    apiAuthors.some((apiAuthor: string) => apiAuthor.includes(refAuthor))
                );

                if (authorMatches.length > 0) {
                    score += 0.2 * (authorMatches.length / refAuthors.length);
                    matchDetails.push(`${authorMatches.length} authors matched`);
                }
            }

            // Year comparison
            if (reference.year && work['published-print']?.['date-parts']?.[0]?.[0]) {
                const apiYear = work['published-print']['date-parts'][0][0];
                if (apiYear === reference.year) {
                    score += 0.2;
                    matchDetails.push("year matched");
                }
            }

            // Journal comparison
            if (reference.journal && work['container-title']?.[0]) {
                const apiJournal = work['container-title'][0].toLowerCase();
                const refJournal = reference.journal.toLowerCase();
                if (apiJournal.includes(refJournal) || refJournal.includes(apiJournal)) {
                    score += 0.15;
                    matchDetails.push("journal matched");
                }
            }

            // Volume and issue comparison
            if (reference.volume && work.volume === reference.volume) {
                score += 0.1;
                matchDetails.push("volume matched");
            }
            if (reference.issue && work.issue === reference.issue) {
                score += 0.05;
                matchDetails.push("issue matched");
            }

            return {
                score: Number(score.toFixed(2)),
                message: matchDetails.join(", "),
                DOI: work.DOI
            };
        });

        // Get the best match
        interface ScoredWork {
            score: number;
            message: string;
            DOI: string;
        }

        const bestMatch: ScoredWork = scoredWorks.reduce((best: ScoredWork, current: ScoredWork) =>
            current.score > best.score ? current : best
        );

        // Consider it valid if the score is high enough
        const isValid = bestMatch.score >= 0.5;

        return {
            isValid,
            message: isValid
                ? `Verified via CrossRef metadata (${bestMatch.message})${bestMatch.DOI ? `, DOI: ${bestMatch.DOI}` : ''}`
                : "No sufficiently matching reference found",
            source: isValid ? "CrossRef" : undefined
        };
    } catch (error) {
        console.error("Error searching CrossRef:", error);
        return {
            isValid: false,
            message: `CrossRef search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
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