```mermaid

sequenceDiagram
    participant U as User
    participant UI as Next.js UI
    participant Q as Processing Queue
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant W3 as Worker 3
    participant DB as Supabase DB
    participant API as External APIs

    Note over U,UI: User selects multiple PDFs<br/>from their local drive
    U->>UI: Select PDFs (no upload)
    UI->>Q: Add file references to queue
    
    Note over Q,W3: Queue manages up to 5<br/>concurrent workers
    Q->>W1: Start Worker 1 with PDF 1
    Q->>W2: Start Worker 2 with PDF 2
    Q->>W3: Start Worker 3 with PDF 3
    
    par Worker 1 Processing
        W1->>W1: Read local PDF
        W1->>API: Process document
        W1->>DB: Update status
        W1->>Q: Worker complete
        Q->>W1: Process next PDF
    and Worker 2 Processing
        W2->>W2: Read local PDF
        W2->>API: Process document
        W2->>DB: Update status
        W2->>Q: Worker complete
        Q->>W2: Process next PDF
    and Worker 3 Processing
        W3->>W3: Read local PDF
        W3->>API: Process document
        W3->>DB: Update status
        W3->>Q: Worker complete
        Q->>W3: Process next PDF
    end

    loop Every 5 seconds
        UI->>DB: Poll for status updates
        DB->>UI: Return processing status
        UI->>U: Update progress table
    end