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

export default function VerifyController(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<VerifyStep>('get')
  const [referenceData, setReferenceData] = useState<any>(null)
  const [verifiedReferences, setVerifiedReferences] = useState<Reference[]>([])

  const handleStepComplete = (step: VerifyStep, data?: any) => {
    console.log(`Step ${step} completed with data:`, data);
    
    switch (step) {
      case 'get':
        setReferenceData(data)
        console.log("Initial reference data:", data)
        setCurrentStep('verify')
        break
      case 'verify':
        const verificationData = data as VerificationData;
        console.log("Verification completed with data:", verificationData);
        console.log("Verified references:", verificationData.references);
        setVerifiedReferences(verificationData.references);
        setCurrentStep('display')
        break
      case 'display':
        console.log("Display completed, resetting to start");
        setCurrentStep('get')
        break
    }
  }

  console.log("Current step:", currentStep);
  console.log("Verified references for display:", verifiedReferences);

  return (
    <>
      {currentStep === 'get' && (
        <GetReferences onComplete={(data) => handleStepComplete('get', data)} />
      )}
      {currentStep === 'verify' && referenceData && (
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