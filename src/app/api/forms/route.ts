/**
 * POST /api/forms
 * Accepts CompleteTaxReturn, assembles PDF forms, returns base64-encoded PDFs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assembleForms } from '@/modules/forms-generation/assembler';

const taxLineItemSchema = z.object({
  value: z.number(),
  label: z.string(),
  source: z.object({ documentId: z.string(), formType: z.string(), boxNumber: z.string() }),
  trace: z.object({
    irsPublication: z.string().optional(),
    njTaxCode: z.string().optional(),
    calculationNote: z.string().optional(),
  }),
  flagged: z.boolean(),
});

const formLineMapSchema = z.record(z.string(), taxLineItemSchema);

const formsSchema = z.object({
  taxpayer: z.object({
    firstName: z.string(),
    lastName: z.string(),
    ssnMasked: z.string(),
    filingStatus: z.enum(["single", "mfj", "mfs", "hoh", "qw"]),
    address: z.object({ street: z.string(), city: z.string(), state: z.string(), zip: z.string() }),
    dependents: z.array(z.object({
      firstName: z.string(), lastName: z.string(), relationship: z.string(),
      birthYear: z.number(), ssnMasked: z.string(), qualifyingChild: z.boolean(), qualifyingRelative: z.boolean(),
    })),
    taxYear: z.number(),
  }),
  taxYear: z.number(),
  federal: z.object({
    form1040: formLineMapSchema, schedule1: formLineMapSchema, schedule2: formLineMapSchema,
    schedule3: formLineMapSchema, scheduleA: formLineMapSchema, scheduleB: formLineMapSchema,
    scheduleD: formLineMapSchema, schedule8812: formLineMapSchema,
  }),
  newJersey: z.object({
    nj1040: formLineMapSchema, scheduleA: formLineMapSchema,
    scheduleB: formLineMapSchema, scheduleC: formLineMapSchema,
  }),
  summary: z.object({
    totalIncome: z.number(), adjustments: z.number(), deductions: z.number(),
    taxableIncome: z.object({ federal: z.number(), state: z.number() }),
    federalTax: z.number(), stateTax: z.number(), totalTax: z.number(),
    totalPayments: z.number(), refundOrOwed: z.number(), effectiveRate: z.number(),
  }),
  auditTrail: z.array(z.object({
    timestamp: z.string(), action: z.string(), fieldPath: z.string(),
    previousValue: z.number().nullable(), newValue: z.number().nullable(), source: z.string(),
  })),
  flags: z.array(z.object({
    fieldPath: z.string(), value: z.number(), reason: z.string(),
    sourceSection: z.string(), needsHumanReview: z.boolean(),
  })),
});

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = formsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const formPdfs = await assembleForms(parsed.data);
    const results = await Promise.all(
      formPdfs.map(async (f) => {
        const base64 = await blobToBase64(f.pdfBlob);
        return { formName: f.formName, pdfBase64: base64 };
      })
    );
    return NextResponse.json({ forms: results, count: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Form generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
