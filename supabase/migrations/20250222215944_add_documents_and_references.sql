CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors JSONB NOT NULL, -- Store array of authors in JSON format
    file_name TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('article', 'book', 'inbook', 'inproceedings', 'proceedings', 'thesis', 'report', 'webpage')),
    authors JSONB, -- Store array of author names
    title TEXT NOT NULL,
    journal TEXT,
    year TEXT,
    volume TEXT,
    pages TEXT,
    DOI TEXT UNIQUE,
    arxivId TEXT UNIQUE,
    PMID TEXT UNIQUE,
    ISBN TEXT UNIQUE,
    url TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('verified', 'unverified', 'error', 'pending')),
    verification_source TEXT,
    verification_notes TEXT,
    search_results JSONB, -- Store structured search results
    parent_reference_id UUID REFERENCES references(id) ON DELETE CASCADE, -- Allow nesting of references
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID REFERENCES references(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- Example: 'verified', 'updated', 'deleted'
    actor_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_references_document_id ON references(document_id);
CREATE INDEX idx_references_verification_status ON references(verification_status);
