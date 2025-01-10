import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/auth-contexts';
import { useReferenceLimit } from '@/app/hooks/useReferenceLimit';
import { Alert, AlertDescription } from '@/components/ui/alert';

// key components
import SearchReferencesComponent from './verify/SearchReferencesComponent';
import VerifyReferencesComponent from './verify/VerifyReferencesComponent';
import GetReferences from './get-references/GetReferences';
import { DisplayReferences } from '@/components/verify/display/DisplayReferences';

import type { Reference } from '@/types/reference';

import TrailState from './TrialState';
export type VerifyStep = 'get' | 'search' | 'verify' | 'display';

// sets whether we want to rate limit or not
// const DISABLE_LIMITS = process.env.NEXT_PUBLIC_DISABLE_REFERENCE_LIMITS === 'true';

const DISABLE_LIMITS = true;

// Input data from GetReferences component
interface GetReferencesData {
  type: string;
  content: string;
}

// Reference data structure after parsing
interface ReferenceData {
  type: string;
  content: Reference[];
}

// Stats for verification process
interface VerificationStats {
  verified: number;
  issues: number;
  pending: number;
  totalReferences: number;
}

// Complete verification data
interface VerificationData {
  stats: VerificationStats;
  references: Reference[];
}

export default function VerifyController(): JSX.Element {
  const { user, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<VerifyStep>('get');
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null
  );
  const [searchedReferences, setSearchedReferences] = useState<Reference[]>([]);
  const [verifiedReferences, setVerifiedReferences] = useState<Reference[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    canProcessReferences,
    remainingReferences,
    limitReferences,
    updateReferenceCount
  } = useReferenceLimit(!!user);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleStepComplete = (step: VerifyStep, data?: any) => {
    setError(null); // Clear any previous errors

    switch (step) {
      case 'get':
        try {
          const getReferencesData = data as GetReferencesData;
          const references = JSON.parse(getReferencesData.content);

          if (!DISABLE_LIMITS && !canProcessReferences) {
            setError(
              "You've reached the maximum number of references. Please sign up for full access."
            );
            return;
          }

          const processedReferences = DISABLE_LIMITS
            ? references
            : limitReferences(references as Reference[]);

          setReferenceData({
            type: getReferencesData.type,
            content: processedReferences
          });
          setCurrentStep('search');

          // Update with the actual number of references being processed
          if (!DISABLE_LIMITS) {
            updateReferenceCount(processedReferences.length);
          }
        } catch (error) {
          console.error('Error parsing reference data:', error);
          setError('Error processing references. Please try again.');
        }
        break;

      case 'search':
        try {
          const searchResults = data as Reference[];
          setSearchedReferences(searchResults);
          setCurrentStep('verify');
        } catch (error) {
          console.error('Error processing search results:', error);
          setError('Error processing search results. Please try again.');
        }
        break;

      case 'verify':
        try {
          const verificationData = data as VerificationData;
          setVerifiedReferences(verificationData.references);
          setCurrentStep('display');
        } catch (error) {
          console.error('Error processing verification:', error);
          setError('Error processing verification. Please try again.');
        }
        break;

      case 'display':
        // Reset state for new verification process
        setReferenceData(null);
        setSearchedReferences([]);
        setVerifiedReferences([]);
        setError(null);
        setCurrentStep('get');
        break;
    }
  };

  return (
    <div className="space-y-4">
      {!DISABLE_LIMITS && !user && (
        <TrailState
          remainingReferences={remainingReferences}
          canProcessReferences={canProcessReferences}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentStep === 'get' && (
        <GetReferences
          onComplete={(data: GetReferencesData) =>
            handleStepComplete('get', data)
          }
          maxReferences={
            !DISABLE_LIMITS && !user ? remainingReferences : undefined
          }
        />
      )}

      {currentStep === 'search' && referenceData && (
        <SearchReferencesComponent
          data={referenceData}
          onComplete={(references: Reference[]) =>
            handleStepComplete('search', references)
          }
        />
      )}

      {currentStep === 'verify' && searchedReferences.length > 0 && (
        <VerifyReferencesComponent
          references={searchedReferences}
          onComplete={(data: VerificationData) =>
            handleStepComplete('verify', data)
          }
        />
      )}

      {currentStep === 'display' && verifiedReferences.length > 0 && (
        <DisplayReferences
          data={verifiedReferences}
          onComplete={() => handleStepComplete('display')}
        />
      )}
    </div>
  );
}
