"use client";

/**
 * Wizard Progress Bar
 * 5-step progress indicator: Upload -> Review -> Questions -> Summary -> Forms
 * Shows completed/current/upcoming states, completion %, clickable completed steps.
 */

import { useTaxReturnStore, WizardStep } from '@/stores/tax-return-store';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: WizardStep.UPLOAD, label: 'Upload' },
  { key: WizardStep.REVIEW, label: 'Review' },
  { key: WizardStep.QUESTIONS, label: 'Questions' },
  { key: WizardStep.SUMMARY, label: 'Summary' },
  { key: WizardStep.FORMS, label: 'Forms' },
];

export function WizardProgress(): JSX.Element {
  const { currentStep, completedSteps, setStep } = useTaxReturnStore();

  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const completedCount = completedSteps.length;
  const percent = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className="text-xs font-medium">{percent}%</span>
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = step.key === currentStep;
          const isClickable = isCompleted && !isCurrent;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => isClickable && setStep(step.key)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary/20 text-primary border-2 border-primary',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                  isClickable && 'cursor-pointer hover:bg-primary/80',
                  !isClickable && 'cursor-default'
                )}
                aria-label={step.label}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1',
                    idx < currentIdx ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {STEPS.map((step) => (
          <span
            key={step.key}
            className={cn(
              'text-[10px]',
              step.key === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
