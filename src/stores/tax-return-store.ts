/**
 * Tax Return Zustand Store
 * Central wizard state: step tracking, taxpayer info, documents,
 * reviewed docs, additional answers, calculated return, forms, errors.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TaxpayerInfo,
  ExtractedDocument,
  CompleteTaxReturn,
  TaxCalculationFlag,
  AuditTrailEntry,
} from '@/lib/types';
import type { FormPDF } from '@/modules/forms-generation/assembler';

export enum WizardStep {
  UPLOAD = 'UPLOAD',
  REVIEW = 'REVIEW',
  QUESTIONS = 'QUESTIONS',
  SUMMARY = 'SUMMARY',
  FORMS = 'FORMS',
}

const STEP_ORDER: WizardStep[] = [
  WizardStep.UPLOAD,
  WizardStep.REVIEW,
  WizardStep.QUESTIONS,
  WizardStep.SUMMARY,
  WizardStep.FORMS,
];

export interface WizardError {
  step: WizardStep;
  fieldPath: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TaxReturnState {
  // Wizard navigation
  currentStep: WizardStep;
  completedSteps: WizardStep[];

  // Taxpayer data
  taxpayer: TaxpayerInfo | null;
  taxYear: number;

  // Documents
  documents: ExtractedDocument[];
  reviewedDocumentIds: string[];

  // Additional answers (not from documents)
  additionalAnswers: Record<string, string | number | boolean>;

  // Calculated return
  calculatedReturn: CompleteTaxReturn | null;
  flags: TaxCalculationFlag[];
  auditTrail: AuditTrailEntry[];

  // Generated forms
  generatedForms: FormPDF[];

  // Errors
  errors: WizardError[];

  // Loading states
  isCalculating: boolean;
  isGeneratingForms: boolean;
}

export interface TaxReturnActions {
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepComplete: (step: WizardStep) => void;
  canAdvance: (step: WizardStep) => boolean;

  setTaxpayer: (info: TaxpayerInfo) => void;
  setTaxYear: (year: number) => void;

  addDocument: (doc: ExtractedDocument) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, doc: Partial<ExtractedDocument>) => void;
  markDocumentReviewed: (id: string) => void;

  setAdditionalAnswer: (key: string, value: string | number | boolean) => void;

  setCalculatedReturn: (ret: CompleteTaxReturn, flags: TaxCalculationFlag[], trail: AuditTrailEntry[]) => void;
  setGeneratedForms: (forms: FormPDF[]) => void;

  setErrors: (errors: WizardError[]) => void;
  clearErrors: () => void;

  setCalculating: (v: boolean) => void;
  setGeneratingForms: (v: boolean) => void;

  reset: () => void;
}

const INITIAL_STATE: TaxReturnState = {
  currentStep: WizardStep.UPLOAD,
  completedSteps: [],
  taxpayer: null,
  taxYear: 2025,
  documents: [],
  reviewedDocumentIds: [],
  additionalAnswers: {},
  calculatedReturn: null,
  flags: [],
  auditTrail: [],
  generatedForms: [],
  errors: [],
  isCalculating: false,
  isGeneratingForms: false,
};

function stepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

function canAdvanceFrom(state: TaxReturnState, step: WizardStep): boolean {
  switch (step) {
    case WizardStep.UPLOAD:
      return state.documents.length > 0;
    case WizardStep.REVIEW:
      return state.documents.length > 0 && state.reviewedDocumentIds.length === state.documents.length;
    case WizardStep.QUESTIONS:
      return true;
    case WizardStep.SUMMARY:
      return state.calculatedReturn !== null;
    case WizardStep.FORMS:
      return state.generatedForms.length > 0;
    default:
      return false;
  }
}

export type TaxReturnStore = TaxReturnState & TaxReturnActions;

export const useTaxReturnStore = create<TaxReturnStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        const idx = stepIndex(currentStep);
        if (idx < STEP_ORDER.length - 1) {
          set({ currentStep: STEP_ORDER[idx + 1] });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const idx = stepIndex(currentStep);
        if (idx > 0) {
          set({ currentStep: STEP_ORDER[idx - 1] });
        }
      },

      markStepComplete: (step) =>
        set((s) => ({
          completedSteps: s.completedSteps.includes(step)
            ? s.completedSteps
            : [...s.completedSteps, step],
        })),

      canAdvance: (step) => canAdvanceFrom(get(), step),

      setTaxpayer: (info) => set({ taxpayer: info }),
      setTaxYear: (year) => set({ taxYear: year }),

      addDocument: (doc) =>
        set((s) => ({ documents: [...s.documents, doc] })),

      removeDocument: (id) =>
        set((s) => ({
          documents: s.documents.filter((d) => d.id !== id),
          reviewedDocumentIds: s.reviewedDocumentIds.filter((rid) => rid !== id),
        })),

      updateDocument: (id, partial) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...partial } : d)),
        })),

      markDocumentReviewed: (id) =>
        set((s) => ({
          reviewedDocumentIds: s.reviewedDocumentIds.includes(id)
            ? s.reviewedDocumentIds
            : [...s.reviewedDocumentIds, id],
        })),

      setAdditionalAnswer: (key, value) =>
        set((s) => ({
          additionalAnswers: { ...s.additionalAnswers, [key]: value },
        })),

      setCalculatedReturn: (ret, flags, trail) =>
        set({ calculatedReturn: ret, flags, auditTrail: trail }),

      setGeneratedForms: (forms) => set({ generatedForms: forms }),

      setErrors: (errors) => set({ errors }),
      clearErrors: () => set({ errors: [] }),

      setCalculating: (v) => set({ isCalculating: v }),
      setGeneratingForms: (v) => set({ isGeneratingForms: v }),

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'tax-return-store',
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        taxpayer: state.taxpayer,
        taxYear: state.taxYear,
        documents: state.documents,
        reviewedDocumentIds: state.reviewedDocumentIds,
        additionalAnswers: state.additionalAnswers,
      }),
    }
  )
);
