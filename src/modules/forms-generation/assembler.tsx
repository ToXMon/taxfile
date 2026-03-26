/**
 * Form Assembly + PDF Download
 * Assembles all applicable PDF forms from a CompleteTaxReturn.
 * Conditionally includes schedules based on return data.
 * Renders each form to a PDF buffer via @react-pdf/renderer.
 */

import { pdf } from '@react-pdf/renderer';
import type { CompleteTaxReturn } from '@/lib/types';
import { Form1040Document } from './federal/form-1040';
import { Schedule1Document, Schedule2Document, Schedule3Document } from './federal/schedule-1-2-3';
import { ScheduleADocument, ScheduleBDocument } from './federal/schedule-a-b';
import { ScheduleDDocument, Schedule8812Document } from './federal/schedule-d-8812';
import { NJ1040Document } from './nj/nj-1040';
import { NJScheduleADocument, NJScheduleBDocument, NJScheduleCDocument } from './nj/nj-schedules';

export interface FormPDF {
  formName: string;
  pdfBlob: Blob;
}

/** Check if a FormLineMap has any entries */
function hasData(map: Record<string, unknown>): boolean {
  return Object.keys(map).length > 0;
}

/** Check if a FormLineMap has any line with a non-zero value */
function hasNonZeroValues(map: Record<string, { value: number }>): boolean {
  return Object.values(map).some((item) => item.value !== 0);
}

/**
 * Assemble all applicable PDF forms from a CompleteTaxReturn.
 * Conditionally includes schedules based on return data.
 */
export async function assembleForms(taxReturn: CompleteTaxReturn): Promise<FormPDF[]> {
  const results: FormPDF[] = [];
  const { taxpayer, taxYear, federal, newJersey } = taxReturn;
  const name = `${taxpayer.firstName} ${taxpayer.lastName}`.trim();
  const filingStatus = taxpayer.filingStatus;

  async function renderForm(formName: string, component: JSX.Element): Promise<void> {
    const instance = pdf(component);
    const blob = await instance.toBlob();
    results.push({ formName, pdfBlob: blob });
  }

  // Federal Form 1040 (always included)
  await renderForm(
    'Form 1040',
    <Form1040Document formLines={federal.form1040} taxYear={taxYear} taxpayerName={name} ssnMasked={taxpayer.ssnMasked} filingStatus={filingStatus} />
  );

  if (hasNonZeroValues(federal.schedule1)) {
    await renderForm('Schedule 1', <Schedule1Document formLines={federal.schedule1} taxYear={taxYear} />);
  }
  if (hasNonZeroValues(federal.schedule2)) {
    await renderForm('Schedule 2', <Schedule2Document formLines={federal.schedule2} taxYear={taxYear} />);
  }
  if (hasNonZeroValues(federal.schedule3)) {
    await renderForm('Schedule 3', <Schedule3Document formLines={federal.schedule3} taxYear={taxYear} />);
  }
  if (hasData(federal.scheduleA)) {
    await renderForm('Schedule A', <ScheduleADocument formLines={federal.scheduleA} taxYear={taxYear} />);
  }
  if (hasData(federal.scheduleB)) {
    await renderForm('Schedule B', <ScheduleBDocument formLines={federal.scheduleB} taxYear={taxYear} />);
  }
  if (hasData(federal.scheduleD)) {
    await renderForm('Schedule D', <ScheduleDDocument formLines={federal.scheduleD} taxYear={taxYear} />);
  }
  if (hasNonZeroValues(federal.schedule8812)) {
    await renderForm('Schedule 8812', <Schedule8812Document formLines={federal.schedule8812} taxYear={taxYear} />);
  }

  // NJ-1040 (always included)
  await renderForm(
    'NJ-1040',
    <NJ1040Document formLines={newJersey.nj1040} taxYear={taxYear} taxpayerName={name} ssnMasked={taxpayer.ssnMasked} filingStatus={filingStatus} />
  );

  if (hasData(newJersey.scheduleA)) {
    await renderForm('NJ Schedule A', <NJScheduleADocument formLines={newJersey.scheduleA} taxYear={taxYear} />);
  }
  if (hasData(newJersey.scheduleB)) {
    await renderForm('NJ Schedule B', <NJScheduleBDocument formLines={newJersey.scheduleB} taxYear={taxYear} />);
  }
  if (hasData(newJersey.scheduleC)) {
    await renderForm('NJ Schedule C', <NJScheduleCDocument formLines={newJersey.scheduleC} taxYear={taxYear} />);
  }

  return results;
}

/** Download all forms as individual PDF files in the browser */
export function downloadForms(forms: FormPDF[]): void {
  for (const { formName, pdfBlob } of forms) {
    const url = URL.createObjectURL(pdfBlob);
    const safeName = formName.replace(/[^a-zA-Z0-9]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
