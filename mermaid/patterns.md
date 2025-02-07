```mermaid
sequenceDiagram
    participant C as Component
    participant S as queueService
    participant DB as Supabase

    Note over C: User has selected files
    
    C->>S: queueService.startQueue(files)
    Note over S: Returns immediately
    
    rect rgb(00, 0, 255)
        Note over C,DB: Status Updates
        loop Every 5 seconds
            C->>S: getQueueStatus()
            S->>DB: Fetch status
            DB->>S: Current status
            S->>C: {queued, processing, completed, failed}
        end
    end