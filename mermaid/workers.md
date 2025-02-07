```mermaid

sequenceDiagram
    participant U as User
    participant Q as Queue
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant DB as Supabase
    
    Note over U,Q: User selects 5 PDFs
    U->>Q: Select PDFs
    
    Note over Q: Initialize worker pool
    Q->>W1: Create Worker 1
    Q->>W2: Create Worker 2

    Note over Q: Start processing
    Q->>W1: postMessage(PDF1)
    Q->>W2: postMessage(PDF2)
    
    par Worker 1
        Note over W1: Processing PDF1...
        W1->>DB: Update: "processing"
        W1->>DB: Update: "complete"
        W1->>Q: onmessage: "ready"
        Q->>W1: postMessage(PDF3)
        Note over W1: Processing PDF3...
        W1->>DB: Update: "processing"
        W1->>DB: Update: "complete"
        W1->>Q: onmessage: "ready"
        Q->>W1: postMessage(PDF5)
    and Worker 2
        Note over W2: Processing PDF2...
        W2->>DB: Update: "processing"
        W2->>DB: Update: "complete"
        W2->>Q: onmessage: "ready"
        Q->>W2: postMessage(PDF4)
        Note over W2: Processing PDF4...
        W2->>DB: Update: "processing"
        W2->>DB: Update: "complete"
        W2->>Q: onmessage: "ready"
        Note over Q: Queue empty
        Q->>W2: terminate()
    end
    
    Note over W1: Processing PDF5...
    W1->>DB: Update: "processing"
    W1->>DB: Update: "complete"
    W1->>Q: onmessage: "ready"
    Note over Q: Queue empty
    Q->>W1: terminate()
    
    Note over Q: All processing complete