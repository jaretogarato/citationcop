import { useEffect, useState } from "react";
import { verifyReference } from "@/actions/verify-references";
import { Reference } from "@/types/reference";

interface VerifiedReference extends Reference {
    status: "checking" | "valid" | "invalid";
    message?: string;
    source?: string;
}

export function useReferenceVerification(referencesJson: string) {
    const [verifiedReferences, setVerifiedReferences] = useState<VerifiedReference[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let references: Reference[] = [];
        try {
            const parsedData = JSON.parse(referencesJson);
            references = parsedData.references || [];
        } catch (error) {
            console.error("Failed to parse references JSON:", error);
        }

        // Initialize verifiedReferences
        const initializedReferences: VerifiedReference[] = references.map(ref => ({
            ...ref,
            status: "checking" as "checking",
            message: "",
            source: "",
        }));

        setVerifiedReferences(initializedReferences);

        const verifyAllReferences = async () => {
            setLoading(true);
            for (let i = 0; i < initializedReferences.length; i++) {
                const ref = initializedReferences[i];
                const { isValid, message, source } = await verifyReference(ref);

                setVerifiedReferences(prevRefs => {
                    const updatedRefs = [...prevRefs];
                    updatedRefs[i] = { ...ref, status: isValid ? "valid" : "invalid", message, source };
                    return updatedRefs;
                });
            }
            setLoading(false);
        };

        verifyAllReferences();
    }, [referencesJson]); // Ensures it only reruns if referencesJson changes


    return { verifiedReferences, loading };
}
