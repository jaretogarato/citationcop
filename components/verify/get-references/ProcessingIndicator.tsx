import { useEffect, useState } from 'react';

interface ProcessingIndicatorProps {
    stage: 'idle' | 'getting' | 'checking';
    isHighAccuracy: boolean;
    progress: { current: number; total: number };
}

export function ProcessingIndicator({
    stage,
    isHighAccuracy,
    progress
}: ProcessingIndicatorProps) {
    const [accuracyStage, setAccuracyStage] = useState(0);
    const accuracyStages = [
        "Analyzing gathered reference data...",
        "Checking raw text in paper...",
        "Fixing errors...",
        "Thinking about the meaning of life..."
        
    ];

    // Handle stage rotation internally
    useEffect(() => {
        if (stage === 'checking') {
            const interval = setInterval(() => {
                setAccuracyStage(prev => (prev + 1) % accuracyStages.length);
            }, 5000);
            return () => clearInterval(interval);
        } else {
            setAccuracyStage(0);
        }
    }, [stage]);

    if (stage === 'idle') return null;

    return (
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="text-right">
                    {stage === 'getting' ? (
                        "Getting references..."
                    ) : (
                        isHighAccuracy ? (
                            <div className="flex flex-col items-end gap-1">
                                <div>{accuracyStages[accuracyStage]}</div>
                                <div className="text-xs text-red-400/70">Deep scanning in progress...</div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end gap-1">
                                <div>{accuracyStages[accuracyStage]}</div>
                                <div className="text-xs text-blue-400/70">Turbo scanning in progress...</div>
                            </div>
                        )
                    )}
                </div>
                <div className={`w-4 h-4 rounded-full ${isHighAccuracy ? 'bg-red-500' : 'bg-blue-500'} animate-pulse`} />

                {progress.total > 0 && (
                    <div className="text-xs ml-2">
                        ({progress.current} / {progress.total})
                    </div>
                )}
            </div>
        </div>
    );
}