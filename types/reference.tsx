export interface FileData {
  file: File | null
  name: string | null
}

export type TabType = "upload" | "paste"

export type VerifyStep = "get" | "verify" | "display"

// uploaded paper metadata info
export interface Author {
  name: string;
  organization: string | null;
}

export interface DocumentMetadata {
  title: string | null;
  authors: Author[];
  date: string | null;
}

export interface MetadataResponse {
  metadata: DocumentMetadata;
}

// references
export type ReferenceStatus = "verified" | "unverified" | "error" | "pending"


export type ReferenceType =
  | 'article'    // Journal article
  | 'book'       // Complete book
  | 'inbook'     // Book chapter
  | 'inproceedings' // Conference paper
  | 'proceedings'   // Conference proceedings
  | 'thesis'     // Thesis/dissertation
  | 'report'     // Technical report, white paper
  | 'webpage'    // Web content

export interface Reference {
  date_of_access: any;
  // Core fields
  id: number
  type?: ReferenceType
  authors: string[]
  title: string

  // Identifiers GROBID can extract
  DOI?: string | null
  arxivId?: string | null
  PMID?: string | null
  ISBN?: string | null
  url?: string | null

  // Publication details
  journal?: string | null
  year?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  conference?: string | null

  // Your app's fields
  status: ReferenceStatus
  verification_source?: string
  message?: string
}


// Type definitions for helper functions
export type StatusColorMap = {
  [K in ReferenceStatus]: string
}

export type StatusTextMap = {
  [K in ReferenceStatus]: string
}

// Main article metadata
interface ArticleMetadata {
  title: string | null
  authors: string[]
  year?: string | null
}