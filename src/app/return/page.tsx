"use client";

/**
 * Tax Return Wizard Page
 * Routes to the appropriate wizard step based on current step in store.
 */

import { useTaxReturnStore } from '@/stores/tax-return-store';
import { UploadStep } from '@/modules/user-flow/steps/upload-step';

export default function ReturnPage(): JSX.Element {
  const currentStep = useTaxReturnStore((s) => s.currentStep);

  return (
    <div className="container max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Prepare Your Tax Return</h1>
      {currentStep === 'UPLOAD' && <UploadStep />}
      {currentStep === 'REVIEW' && <div className="text-muted-foreground">Review step coming soon...</div>}
      {currentStep === 'QUESTIONS' && <div className="text-muted-foreground">Questions step coming soon...</div>}
      {currentStep === 'SUMMARY' && <div className="text-muted-foreground">Summary step coming soon...</div>}
      {currentStep === 'FORMS' && <div className="text-muted-foreground">Forms step coming soon...</div>}
    </div>
  );
}
