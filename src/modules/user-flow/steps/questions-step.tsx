"use client";

/**
 * Additional Questions Step
 * Grouped: Filing Info, Dependents, Deductions, Other Income, Retirement, Health.
 * Tooltips, conditional skip, dependent qualifying child fields, Zod validation.
 */

import { useState, useMemo } from 'react';
import { useTaxReturnStore, WizardStep } from '@/stores/tax-return-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';

interface QuestionDef {
  key: string;
  label: string;
  tooltip: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  showWhen?: (answers: Record<string, string | number | boolean>) => boolean;
}

interface QuestionGroup {
  title: string;
  questions: QuestionDef[];
}

const QUESTION_GROUPS: QuestionGroup[] = [
  {
    title: 'Filing Information',
    questions: [
      { key: 'filingStatus', label: 'Filing Status', tooltip: 'Determines tax brackets and standard deduction', type: 'select',
        options: ['single', 'mfj', 'mfs', 'hoh', 'qw'] },
      { key: 'stateOfResidence', label: 'State of Residence', tooltip: 'Determines state tax calculation', type: 'select',
        options: ['NJ', 'NY', 'PA', 'CT', 'Other'] },
    ],
  },
  {
    title: 'Dependents',
    questions: [
      { key: 'hasDependents', label: 'Do you have dependents?', tooltip: 'Children or other qualifying persons you support', type: 'select',
        options: ['yes', 'no'] },
      { key: 'numDependents', label: 'Number of dependents', tooltip: 'Total count of qualifying dependents', type: 'number',
        showWhen: (a) => a.hasDependents === 'yes' },
      { key: 'numQualifyingChildren', label: 'Qualifying children under 17', tooltip: 'Children under 17 for Child Tax Credit ($2,000/child)', type: 'number',
        showWhen: (a) => a.hasDependents === 'yes' },
      { key: 'numOtherDependents', label: 'Other dependents', tooltip: 'Qualifying relatives for $500 credit', type: 'number',
        showWhen: (a) => a.hasDependents === 'yes' },
    ],
  },
  {
    title: 'Deductions',
    questions: [
      { key: 'deductionType', label: 'Deduction method', tooltip: 'Standard or itemized deductions', type: 'select',
        options: ['standard', 'itemized'] },
      { key: 'charitableContributions', label: 'Total charitable contributions', tooltip: 'Cash and non-cash gifts to qualified organizations', type: 'number',
        showWhen: (a) => a.deductionType === 'itemized' },
      { key: 'medicalExpenses', label: 'Medical and dental expenses', tooltip: 'Must exceed 7.5% of AGI to deduct', type: 'number',
        showWhen: (a) => a.deductionType === 'itemized' },
    ],
  },
  {
    title: 'Other Income',
    questions: [
      { key: 'hasOtherIncome', label: 'Other income sources?', tooltip: 'Alimony, jury duty, gambling, etc.', type: 'select',
        options: ['yes', 'no'] },
      { key: 'alimonyReceived', label: 'Alimony received', tooltip: 'For divorces finalized before 2019 only', type: 'number',
        showWhen: (a) => a.hasOtherIncome === 'yes' },
      { key: 'gamblingIncome', label: 'Gambling winnings', tooltip: 'Reportable on Schedule 1', type: 'number',
        showWhen: (a) => a.hasOtherIncome === 'yes' },
    ],
  },
  {
    title: 'Retirement & Health',
    questions: [
      { key: 'studentLoanInterest', label: 'Student loan interest paid', tooltip: 'Max $2,500 deduction, subject to income phase-out', type: 'number' },
      { key: 'educatorExpenses', label: 'Educator expenses', tooltip: 'Up to $300 for K-12 teachers', type: 'number' },
      { key: 'hasHSA', label: 'HSA contributions?', tooltip: 'Health Savings Account - tax-advantaged', type: 'select',
        options: ['yes', 'no'] },
      { key: 'hsaContribution', label: 'HSA contribution amount', tooltip: '2025 limits: $4,300 individual / $8,550 family', type: 'number',
        showWhen: (a) => a.hasHSA === 'yes' },
    ],
  },
];

const validationSchema = z.object({
  filingStatus: z.enum(['single', 'mfj', 'mfs', 'hoh', 'qw']),
  stateOfResidence: z.string().min(1),
  numDependents: z.number().min(0).optional(),
  numQualifyingChildren: z.number().min(0).optional(),
  deductionType: z.enum(['standard', 'itemized']),
});

function TooltipLabel({ label, tooltip }: { label: string; tooltip: string }): JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Label className="cursor-help flex items-center gap-1">
            {label}
            <span className="text-muted-foreground text-xs">(?)</span>
          </Label>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function QuestionsStep(): JSX.Element {
  const { additionalAnswers, setAdditionalAnswer, nextStep, prevStep, markStepComplete } = useTaxReturnStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const visibleGroups = useMemo(
    () => QUESTION_GROUPS.map((group) => ({
      ...group,
      questions: group.questions.filter((q) => !q.showWhen || q.showWhen(additionalAnswers)),
    })),
    [additionalAnswers]
  );

  const handleValidate = (): boolean => {
    const result = validationSchema.safeParse(additionalAnswers);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleAdvance = () => {
    if (handleValidate()) {
      markStepComplete(WizardStep.QUESTIONS);
      nextStep();
    }
  };

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => {
        const visibleQuestions = group.questions;
        if (visibleQuestions.length === 0) return null;
        return (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleQuestions.map((q) => (
                <div key={q.key} className="space-y-1">
                  <TooltipLabel label={q.label} tooltip={q.tooltip} />
                  {q.type === 'select' && q.options && (
                    <Select
                      value={(additionalAnswers[q.key] as string) ?? ''}
                      onValueChange={(v) => setAdditionalAnswer(q.key, v)}
                    >
                      <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {q.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {q.type === 'number' && (
                    <Input
                      type="number"
                      value={(additionalAnswers[q.key] as number) ?? ''}
                      onChange={(e) => setAdditionalAnswer(q.key, parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  )}
                  {q.type === 'text' && (
                    <Input
                      type="text"
                      value={(additionalAnswers[q.key] as string) ?? ''}
                      onChange={(e) => setAdditionalAnswer(q.key, e.target.value)}
                      className="h-9"
                    />
                  )}
                  {errors[q.key] && (
                    <p className="text-xs text-destructive">{errors[q.key]}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>Please fix the highlighted errors before continuing.</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>Back</Button>
        <Button onClick={handleAdvance}>Continue to Summary</Button>
      </div>
    </div>
  );
}
