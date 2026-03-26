"use client";

/**
 * Review Extracted Data Step
 * Expandable doc cards, editable fields, low-confidence warnings,
 * tooltips explaining each field, save per doc, progress %.
 */

import { useState, useCallback } from 'react';
import type { ExtractedDocument, TaxLineItem } from '@/lib/types';
import { useTaxReturnStore, WizardStep } from '@/stores/tax-return-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const FIELD_DESCRIPTIONS: Record<string, string> = {
  wages: 'Total wages, tips, and other compensation from Box 1',
  federal_withheld: 'Federal income tax withheld from Box 2',
  state_withheld: 'State income tax withheld from Box 17',
  ss_withheld: 'Social Security tax withheld from Box 4',
  medicare_withheld: 'Medicare tax withheld from Box 6',
  interest_income: 'Taxable interest income',
  tax_exempt_interest: 'Tax-exempt interest income',
  ordinary_dividends: 'Total ordinary dividends',
  qualified_dividends: 'Qualified dividends eligible for lower tax rates',
  proceeds: 'Gross proceeds from sale of securities',
  cost_basis: 'Cost basis of securities sold',
  mortgage_interest: 'Mortgage interest paid on primary residence',
  property_tax: 'Real estate taxes paid',
};

function FieldRow({
  fieldKey,
  item,
  confidence,
  onChange,
}: {
  fieldKey: string;
  item: TaxLineItem;
  confidence: number;
  onChange: (key: string, value: number) => void;
}): JSX.Element {
  const isLow = confidence < LOW_CONFIDENCE_THRESHOLD && confidence > 0;
  const desc = FIELD_DESCRIPTIONS[fieldKey] ?? '';

  return (
    <div className="flex items-center gap-2 py-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs font-medium w-32 truncate cursor-help">
              {item.label || fieldKey}
            </span>
          </TooltipTrigger>
          {desc && (
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{desc}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <Input
        type="number"
        value={item.value || ''}
        onChange={(e) => onChange(fieldKey, parseFloat(e.target.value) || 0)}
        className="h-7 text-sm w-32"
      />
      <Badge variant={isLow ? 'destructive' : 'outline'} className="text-xs">
        {Math.round(confidence * 100)}%
      </Badge>
      {isLow && (
        <Alert variant="destructive" className="py-1 px-2 flex-1">
          <AlertDescription className="text-xs">Low confidence - verify value</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function ReviewStep(): JSX.Element {
  const {
    documents,
    reviewedDocumentIds,
    updateDocument,
    markDocumentReviewed,
    nextStep,
    markStepComplete,
  } = useTaxReturnStore();

  const [editedDocs, setEditedDocs] = useState<Record<string, Record<string, number>>>({});

  const handleFieldChange = useCallback((docId: string, fieldKey: string, value: number) => {
    setEditedDocs((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], [fieldKey]: value },
    }));
  }, []);

  const handleSaveDoc = useCallback((docId: string) => {
    const edits = editedDocs[docId];
    if (edits) {
      const updatedFields: Record<string, TaxLineItem> = {};
      for (const [key, val] of Object.entries(edits)) {
        updatedFields[key] = {
          ...({} as TaxLineItem),
          value: val,
          label: '',
          source: { documentId: '', formType: '', boxNumber: '' },
          trace: {},
          flagged: false,
        };
      }
      updateDocument(docId, { fields: { ...updatedFields } } as Partial<ExtractedDocument>);
      setEditedDocs((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }
    markDocumentReviewed(docId);
  }, [editedDocs, updateDocument, markDocumentReviewed]);

  const reviewedCount = reviewedDocumentIds.length;
  const totalCount = documents.length;
  const progressPercent = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  const handleAdvance = () => {
    markStepComplete(WizardStep.REVIEW);
    nextStep();
  };

  const allReviewed = reviewedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Review Extracted Data</CardTitle>
            <Badge variant="outline">{reviewedCount}/{totalCount} reviewed</Badge>
          </div>
          <Progress value={progressPercent} className="mt-2" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Review and correct extracted values. Fields with low confidence are highlighted.
          </p>

          <Accordion type="multiple" className="w-full">
            {documents.map((doc) => {
              const isReviewed = reviewedDocumentIds.includes(doc.id);
              const fieldEntries = Object.entries(doc.fields);
              return (
                <AccordionItem key={doc.id} value={doc.id}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge>{doc.type}</Badge>
                      <span>{doc.sourceFile}</span>
                      {isReviewed && <Badge variant="secondary">Reviewed</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1 pl-2">
                      {fieldEntries.map(([key, item]) => (
                        <FieldRow
                          key={key}
                          fieldKey={key}
                          item={item}
                          confidence={doc.confidence[key] ?? 0}
                          onChange={(fk, v) => handleFieldChange(doc.id, fk, v)}
                        />
                      ))}
                      {fieldEntries.length === 0 && (
                        <p className="text-xs text-muted-foreground">No fields extracted</p>
                      )}
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button size="sm" onClick={() => handleSaveDoc(doc.id)}>
                        {isReviewed ? 'Update & Confirm' : 'Confirm Review'}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => useTaxReturnStore.getState().prevStep()}>
          Back
        </Button>
        <Button onClick={handleAdvance} disabled={!allReviewed}>
          Continue to Questions
        </Button>
      </div>
    </div>
  );
}
