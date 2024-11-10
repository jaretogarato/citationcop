export interface FileData {
  file: File | null
  name: string | null
}

export type TabType = "upload" | "paste"

export type VerifyStep = "get" | "verify" | "display"

export interface VerifyControllerProps {
  currentStep: VerifyStep
  onStepComplete: (step: VerifyStep, data?: any) => void
}

export type ReferenceStatus = "verified" | "unverified" | "error" | "pending"


export interface Reference {
  id: number
  authors: string[]
  title: string
  journal?: string | null
  year?: string | null
  DOI?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  conference?: string | null
  url?: string | null
  date_of_access?: string | null
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
