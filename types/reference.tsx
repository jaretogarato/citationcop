export interface Reference {
  id: number;
  author: string[];
  title: string;
  journal?: string | null;
  year?: string | null;
  DOI?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  conference?: string | null;
  url?: string | null;
  date_of_access?: string | null;
}

export interface VerifiedReference extends Reference {
  status: "checking" | "valid" | "invalid";
  message?: string;
  source?: string;
}

