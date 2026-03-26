"use client";

/**
 * Tax Summary Dashboard
 * Total Income, AGI, Deductions (method+why), Taxable Income (fed+NJ),
 * Fed Tax, State Tax, Total Tax, Payments, Refund/Owed (prominent, color-coded),
 * Effective Rate. Expandable schedules. Audit trail drill-down.
 */

import { useState } from 'react';
import type { CompleteTaxReturn, AuditTrailEntry } from '@/lib/types';
import { useTaxReturnStore, WizardStep } from '@/stores/tax-return-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

function fmtCurrency(value: number): string {
  if (value < 0) return `($${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })})`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function SummaryRow({ label, value, onClick, highlight }: {
  label: string; value: string; onClick?: () => void; highlight?: boolean;
}): JSX.Element {
  return (
    <div className={`flex justify-between py-1.5 px-2 rounded ${highlight ? 'bg-muted' : ''}`}>
      <span className="text-sm">{label}</span>
      <span
        className={`text-sm font-mono font-medium ${onClick ? 'cursor-pointer underline text-primary' : ''}`}
        onClick={onClick}
      >
        {value}
      </span>
    </div>
  );
}

function AuditTrailDialog({ entries, open, onClose }: {
  entries: AuditTrailEntry[]; open: boolean; onClose: () => void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Audit Trail</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="border rounded p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <Badge variant="outline">{entry.action}</Badge>
                  <span className="text-muted-foreground">{entry.timestamp}</span>
                </div>
                <div>Field: <span className="font-mono">{entry.fieldPath}</span></div>
                <div className="flex gap-4">
                  {entry.previousValue !== null && <span>Before: {entry.previousValue}</span>}
                  {entry.newValue !== null && <span>After: {entry.newValue}</span>}
                </div>
                <div className="text-muted-foreground">Source: {entry.source}</div>
              </div>
            ))}
            {entries.length === 0 && <p className="text-muted-foreground">No audit entries</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleAccordion({ ret }: { ret: CompleteTaxReturn }): JSX.Element {
  const scheduleData = [
    { id: 'sched1', title: 'Schedule 1 - Additional Income & Adjustments', lines: ret.federal.schedule1 },
    { id: 'sched2', title: 'Schedule 2 - Additional Taxes', lines: ret.federal.schedule2 },
    { id: 'sched3', title: 'Schedule 3 - Additional Credits', lines: ret.federal.schedule3 },
    { id: 'schedA', title: 'Schedule A - Itemized Deductions', lines: ret.federal.scheduleA },
    { id: 'schedB', title: 'Schedule B - Interest & Dividends', lines: ret.federal.scheduleB },
    { id: 'schedD', title: 'Schedule D - Capital Gains', lines: ret.federal.scheduleD },
    { id: 'sched8812', title: 'Schedule 8812 - Child Tax Credit', lines: ret.federal.schedule8812 },
    { id: 'nj-schedA', title: 'NJ Schedule A - Deductions', lines: ret.newJersey.scheduleA },
    { id: 'nj-schedB', title: 'NJ Schedule B - Interest & Dividends', lines: ret.newJersey.scheduleB },
    { id: 'nj-schedC', title: 'NJ Schedule C - Business Income', lines: ret.newJersey.scheduleC },
  ].filter((s) => Object.keys(s.lines).length > 0);

  if (scheduleData.length === 0) return <></>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Schedule Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple">
          {scheduleData.map((sched) => (
            <AccordionItem key={sched.id} value={sched.id}>
              <AccordionTrigger className="text-sm">{sched.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {Object.entries(sched.lines).map(([key, item]) => (
                    <div key={key} className="flex justify-between text-xs py-0.5">
                      <span>{item.label || key}</span>
                      <span className="font-mono">{fmtCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function SummaryStep(): JSX.Element {
  const { calculatedReturn, auditTrail, flags, nextStep, prevStep, markStepComplete } = useTaxReturnStore();
  const [auditOpen, setAuditOpen] = useState(false);

  if (!calculatedReturn) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No calculated return available. Please complete previous steps.
        </CardContent>
      </Card>
    );
  }

  const { summary } = calculatedReturn;
  const isRefund = summary.refundOrOwed >= 0;
  const deductionMethod = calculatedReturn.federal.scheduleA && Object.keys(calculatedReturn.federal.scheduleA).length > 0
    ? 'Itemized' : 'Standard';

  const handleAdvance = () => {
    markStepComplete(WizardStep.SUMMARY);
    nextStep();
  };

  return (
    <div className="space-y-6">
      {/* Refund / Amount Owed - Prominent */}
      <Card className={isRefund ? 'border-green-500' : 'border-red-500'}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            {isRefund ? 'Your Estimated Refund' : 'You May Owe'}
          </p>
          <p className={`text-4xl font-bold ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
            {fmtCurrency(Math.abs(summary.refundOrOwed))}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Effective tax rate: {(summary.effectiveRate * 100).toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* Federal Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Federal Tax Summary</CardTitle>
            <Badge variant="outline">Deduction: {deductionMethod}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-0.5">
          <SummaryRow label="Total Income" value={fmtCurrency(summary.totalIncome)} />
          <SummaryRow label="Adjustments" value={fmtCurrency(-summary.adjustments)} />
          <SummaryRow label="Deductions" value={fmtCurrency(-summary.deductions)} highlight />
          <SummaryRow label="Taxable Income (Federal)" value={fmtCurrency(summary.taxableIncome.federal)} highlight />
          <SummaryRow label="Federal Tax" value={fmtCurrency(summary.federalTax)} />
          <SummaryRow label="Total Payments" value={fmtCurrency(summary.totalPayments)} />
          <SummaryRow
            label="Refund / (Owed)"
            value={fmtCurrency(summary.refundOrOwed)}
            highlight
          />
        </CardContent>
      </Card>

      {/* NJ State Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New Jersey State Tax</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          <SummaryRow label="Taxable Income (NJ)" value={fmtCurrency(summary.taxableIncome.state)} />
          <SummaryRow label="NJ State Tax" value={fmtCurrency(summary.stateTax)} />
        </CardContent>
      </Card>

      {/* Flags / Warnings */}
      {flags.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-yellow-600">Flags & Warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flags.map((flag, i) => (
              <div key={i} className="text-sm"><Badge variant={flag.needsHumanReview ? "destructive" : "outline"}>{flag.needsHumanReview ? "Review Needed" : "Info"}</Badge> {flag.reason}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Expandable Schedules */}
      <ScheduleAccordion ret={calculatedReturn} />

      {/* Audit Trail */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
          View Audit Trail ({auditTrail.length} entries)
        </Button>
      </div>

      <AuditTrailDialog entries={auditTrail} open={auditOpen} onClose={() => setAuditOpen(false)} />

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>Back</Button>
        <Button onClick={handleAdvance}>Continue to Forms</Button>
      </div>
    </div>
  );
}
