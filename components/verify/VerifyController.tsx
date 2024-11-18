import React, { useState } from 'react';
import SearchReferencesComponent from './verify/SearchReferencesComponent'
import VerifyReferencesComponent from './verify/VerifyReferencesComponent';
import GetReferences from './get-references/GetReferences';
import { DisplayReferences } from '@/components/verify/display/DisplayReferences';

import type { Reference } from '@/types/reference';

export type VerifyStep = "get" | "search" | "verify" | "display";

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
  const [currentStep, setCurrentStep] = useState<VerifyStep>('get');
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [searchedReferences, setSearchedReferences] = useState<Reference[]>([]);
  const [verifiedReferences, setVerifiedReferences] = useState<Reference[]>([]);

  const handleStepComplete = (step: VerifyStep, data?: any) => {
    switch (step) {
      case 'get':
        try {
          const getReferencesData = data as GetReferencesData;
          const references = JSON.parse(getReferencesData.content);
          setReferenceData({
            type: getReferencesData.type,
            content: references as Reference[]
          });
          setCurrentStep('search');
        } catch (error) {
          console.error("Error parsing reference data:", error);
        }
        break;

      case 'search':
        const searchResults = data as Reference[];
        setSearchedReferences(searchResults);
        setCurrentStep('verify');
        break;

      case 'verify':
        const verificationData = data as VerificationData;
        setVerifiedReferences(verificationData.references);
        setCurrentStep('display');
        break;

      case 'display':
        // Reset state for new verification process
        setReferenceData(null);
        setSearchedReferences([]);
        setVerifiedReferences([]);
        setCurrentStep('get');
        break;
    }
  };

  return (
    <>
      {currentStep === 'get' && (
        <GetReferences 
          onComplete={(data: GetReferencesData) => handleStepComplete('get', data)} 
        />
      )}
      
      {currentStep === 'search' && referenceData && (
        <SearchReferencesComponent
          data={referenceData}
          onComplete={(references: Reference[]) => handleStepComplete('search', references)}
        />
      )}

      {currentStep === 'verify' && searchedReferences.length > 0 && (
        <VerifyReferencesComponent
          references={searchedReferences}
          onComplete={(data: VerificationData) => handleStepComplete('verify', data)}
        />
      )}

      {currentStep === 'display' && verifiedReferences.length > 0 && (
        <DisplayReferences
          data={verifiedReferences}
          onComplete={() => handleStepComplete('display')}
        />
      )}
    </>
  );
}