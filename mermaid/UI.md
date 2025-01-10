```mermaid

sequenceDiagram
    participant U as User
    participant UI as UI Component
    participant H as useQueue Hook
    participant DB as Supabase
    
    Note over UI: Component only knows about:<br/>1. selectedFiles state<br/>2. useQueue hook<br/>3. status display

    U->>UI: Select PDFs
    UI->>UI: setSelectedFiles(files)
    
    U->>UI: Click Start
    UI->>H: startProcessing(selectedFiles)
    
    rect rgb(200, 220, 255)
        Note over UI,DB: Hook handles polling
        loop Every 5 seconds
            H->>DB: Get status
            DB->>H: Return states
            H->>UI: Update status
            UI->>U: Show progress
        end
    end

    Note over UI: UI just renders:<br/>1. File input<br/>2. Start button<br/>3. Status from hook