//app/types/references.ts

export interface Document {
  pdfId: string
  references: Reference[]
}

export interface FileData {
  file: File | null
  name: string | null
}

export type TabType = 'upload' | 'paste'

export interface UrlVerificationResult {
  status: ReferenceStatus
  message: string
}

// uploaded paper metadata info
export interface Author {
  name: string
  organization: string | null
}

export interface DocumentMetadata {
  title: string | null
  authors: Author[]
  date: string | null
}

export interface MetadataResponse {
  metadata: DocumentMetadata
}

export type ReferenceStatus =
  | 'verified'
  | 'unverified'
  | 'needs-human'
  | 'error'
  | 'pending'

export type ReferenceType =
  | 'article' // Journal article
  | 'book' // Complete book
  | 'inbook' // Book chapter
  | 'inproceedings' // Conference paper
  | 'proceedings' // Conference proceedings
  | 'thesis' // Thesis/dissertation
  | 'report' // Technical report, white paper
  | 'webpage' // Web content

// New types for search results
export interface SearchResultItem {
  title: string
  link: string
  snippet: string
}

export interface GoogleSearchResult {
  organic?: SearchResultItem[]
  knowledgeGraph?: any
  searchParameters?: {
    q: string
    gl: string
    hl: string
  }
}

export interface ExtractedReference {
  text: string
  pageNumber: number
}

export interface Reference {
  date_of_access: any
  // Core fields
  id: string
  type?: ReferenceType
  authors: string[]
  title: string

  DOI?: string | null
  arxivId?: string | null
  PMID?: string | null
  ISBN?: string | null
  url?: string | null
  sourceDocument?: string | null // Add this line

  journal?: string | null
  year?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  conference?: string | null

  // raw reference string
  raw: string

  // Your app's fields
  status: ReferenceStatus
  verification_source?: string
  message?: string
  url_valid?: boolean
  url_match?: boolean

  // New field for search results
  searchResults?: GoogleSearchResult

  fixedReference?: string | null

}

// Type definitions for helper functions
export type StatusColorMap = {
  [K in ReferenceStatus]: string
}

export type StatusTextMap = {
  [K in ReferenceStatus]: string
}

// Main article metadata
/*interface ArticleMetadata {
  title: string | null
  authors: string[]
  year?: string | null
}*/

export interface VerificationResults {
  verified: number
  issues: number
  pending: number
  totalReferences: number
}

export interface RefPagesResult {
  pages: number[]
  rawText: string[]
  imageData: string[]
}