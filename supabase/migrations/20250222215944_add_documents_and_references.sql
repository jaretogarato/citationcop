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

CREATE TABLE citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('article', 'book', 'inbook', 'inproceedings', 'proceedings', 'thesis', 'report', 'webpage')),
    authors JSONB,
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
    search_results JSONB,
    parent_reference_id UUID REFERENCES citations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID REFERENCES citations(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- Example: 'verified', 'updated', 'deleted'
    actor_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- ✅ Fix index names to use "citations" instead of "references"
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_citations_document_id ON citations(document_id);
CREATE INDEX idx_citations_verification_status ON citations(verification_status);
