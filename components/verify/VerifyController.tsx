'use client'

import React, { useState } from 'react'
import GetReferences from './GetReferences'
import VerifyReferences from './VerifyReferences'
import DisplayReferences from './DisplayReferences'
import type { VerifyStep, Reference } from '@/types/reference'

interface VerificationData {
  stats: {
    verified: number
    issues: number
    pending: number
    totalReferences: number
  }
  references: Reference[]
}

interface VerifyControllerProps {
  currentStep: VerifyStep
  onStepComplete: (step: VerifyStep, data?: any) => void
}

export default function VerifyController(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<VerifyStep>('get')
  const [referenceData, setReferenceData] = useState<any>(null)
  const [verifiedReferences, setVerifiedReferences] = useState<Reference[]>([])

  const handleStepComplete = (step: VerifyStep, data?: any) => {
   
    switch (step) {
      case 'get':
        try {
          // data.content is already a string of references
          const references = JSON.parse(data.content);

          //console.log("**** Parsed reference data:", references);

          setReferenceData({
            type: data.type,
            content: references as Reference[]
          });
          //console.log("Initial reference data:", references);
          setCurrentStep('verify');
        } catch (error) {
          console.error("Error parsing reference data:", error);
        }
        break;
      case 'verify':
        const verificationData = data as VerificationData;
        //console.log("Verification completed with data:", verificationData);
        //console.log("Verified references:", verificationData.references);
        setVerifiedReferences(verificationData.references);
        setCurrentStep('display')
        break
      case 'display':
        //console.log("Display completed, resetting to start");
        setCurrentStep('get')
        break
    }
  }

  //console.log("Current step:", currentStep);

  return (
    <>
      {currentStep === 'get' && (
        <GetReferences onComplete={(data) => handleStepComplete('get', data)} />
      )}
      {currentStep === 'verify' && referenceData && (
        //console.log("Reference data going into VERIFY", referenceData),
        <VerifyReferences
          data={referenceData}
          onComplete={(data) => handleStepComplete('verify', data)}
        />
      )}
      {currentStep === 'display' && verifiedReferences && (
        <DisplayReferences
          data={verifiedReferences}
          onComplete={() => handleStepComplete('display')}
        />
      )}
    </>
  )
}