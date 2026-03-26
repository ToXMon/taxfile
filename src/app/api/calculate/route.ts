/**
 * POST /api/calculate
 * Accepts TaxCalculationInputs (OrchestratorInput), runs full tax calculation,
 * returns CompleteTaxReturn with flags and audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateFullReturn } from '@/modules/tax-engine/orchestrator';
import type { OrchestratorInput } from '@/modules/tax-engine/orchestrator';

const dependentSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  relationship: z.string(),
  birthYear: z.number(),
  ssnMasked: z.string(),
  qualifyingChild: z.boolean(),
  qualifyingRelative: z.boolean(),
});

const additionalAnswersSchema = z.object({
  otherIncome: z.number(),
  otherAdjustments: z.number(),
  njResident: z.boolean(),
  njPropertyTaxPaid: z.number(),
  studentLoanInterestPaid: z.number(),
  educatorExpenses: z.number(),
  iraContributions: z.number(),
  hsaContributions: z.number(),
  alimonyPaid: z.number(),
  alimonyReceived: z.number(),
});

const calculateSchema = z.object({
  taxpayer: z.object({
    firstName: z.string(),
    lastName: z.string(),
    ssnMasked: z.string(),
    filingStatus: z.enum(['single', 'mfj', 'mfs', 'hoh', 'qw']),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
    }),
    dependents: z.array(dependentSchema),
    taxYear: z.number(),
  }),
  documents: z.array(z.object({
    id: z.string(),
    type: z.enum([
      'W2', '1099-INT', '1099-DIV', '1099-B', '1099-NEC',
      '1099-MISC', '1098', '1098-T', '1098-E', '1095-A', '1095-B', '1095-C',
    ]),
    sourceFile: z.string(),
    fields: z.record(z.string(), z.object({
      value: z.number(),
      label: z.string(),
      source: z.object({ documentId: z.string(), formType: z.string(), boxNumber: z.string() }),
      trace: z.object({
        irsPublication: z.string().optional(),
        njTaxCode: z.string().optional(),
        calculationNote: z.string().optional(),
      }),
      flagged: z.boolean(),
    })),
    confidence: z.record(z.string(), z.number()),
    reviewed: z.boolean(),
  })),
  additionalAnswers: additionalAnswersSchema,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = calculateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const input: OrchestratorInput = {
      taxpayer: parsed.data.taxpayer,
      documents: parsed.data.documents,
      additionalAnswers: parsed.data.additionalAnswers,
    };

    const result = calculateFullReturn(input);

    return NextResponse.json({
      taxpayer: result.taxpayer,
      taxYear: result.taxYear,
      federal: result.federal,
      newJersey: result.newJersey,
      summary: result.summary,
      auditTrail: result.auditTrail,
      flags: result.flags,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calculation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
