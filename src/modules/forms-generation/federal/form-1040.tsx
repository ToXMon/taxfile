/**
 * Form 1040 PDF Component — 2-page IRS layout
 * Renders completed Form 1040 from CompleteTaxReturn.federal.form1040.
 * Uses @react-pdf/renderer Document/Page/View/Text primitives.
 */

import { Document, Page, View, Text } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLine, PartHeader, Disclaimer, getVal, getLabel } from './helpers';

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single', mfj: 'Married Filing Jointly', mfs: 'Married Filing Separately', hoh: 'Head of Household', qw: 'Qualifying Surviving Spouse',
};

interface Form1040Props {
  formLines: FormLineMap;
  taxYear: number;
  taxpayerName: string;
  ssnMasked: string;
  filingStatus: string;
}

function Form1040Page1({ formLines, taxYear, taxpayerName, ssnMasked, filingStatus }: Form1040Props): JSX.Element {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.formTitle}>Form 1040</Text>
      <Text style={styles.formSubTitle}>U.S. Individual Income Tax Return — {taxYear}</Text>
      <View style={styles.sectionBorder}>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={{ flex: 1, fontSize: 8 }}>Name: {taxpayerName}</Text>
          <Text style={{ fontSize: 8 }}>SSN: {ssnMasked}</Text>
        </View>
        <Text style={{ fontSize: 8, marginBottom: 6 }}>Filing Status: {FILING_STATUS_LABELS[filingStatus] ?? filingStatus}</Text>
      </View>

      <PartHeader title="Income" />
      <FormLine num="1" label={getLabel(formLines, 'L1') || 'Wages, salaries, tips'} value={getVal(formLines, 'L1')} />
      <FormLine num="2a" label={getLabel(formLines, 'L2a') || 'Tax-exempt interest'} value={getVal(formLines, 'L2a')} />
      <FormLine num="2b" label={getLabel(formLines, 'L2b') || 'Taxable interest'} value={getVal(formLines, 'L2b')} />
      <FormLine num="3a" label={getLabel(formLines, 'L3a') || 'Qualified dividends'} value={getVal(formLines, 'L3a')} />
      <FormLine num="3b" label={getLabel(formLines, 'L3b') || 'Ordinary dividends'} value={getVal(formLines, 'L3b')} />
      <FormLine num="7" label={getLabel(formLines, 'L7') || 'Capital gain or (loss)'} value={getVal(formLines, 'L7')} />
      <FormLine num="9" label={getLabel(formLines, 'L9') || 'Total income'} value={getVal(formLines, 'L9')} />
      <PartHeader title="Adjustments to Income" />
      <FormLine num="10" label={getLabel(formLines, 'L10') || 'Adjustments to income'} value={getVal(formLines, 'L10')} />
      <FormLine num="11" label={getLabel(formLines, 'L11') || 'Adjusted Gross Income'} value={getVal(formLines, 'L11')} />

      <PartHeader title="Deductions" />
      <FormLine num="12" label={getLabel(formLines, 'L12') || 'Deductions'} value={getVal(formLines, 'L12')} />
      <FormLine num="14" label={getLabel(formLines, 'L14') || 'Total deductions'} value={getVal(formLines, 'L14')} />
      <FormLine num="15" label={getLabel(formLines, 'L15') || 'Taxable income'} value={getVal(formLines, 'L15')} />
      <Disclaimer />
    </Page>
  );
}

function Form1040Page2({ formLines }: { formLines: FormLineMap }): JSX.Element {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.formTitle}>Form 1040 (Page 2)</Text>

      <PartHeader title="Tax and Credits" />
      <FormLine num="16" label={getLabel(formLines, 'L16') || 'Tax'} value={getVal(formLines, 'L16')} />
      <FormLine num="18" label={getLabel(formLines, 'L18') || 'Tax'} value={getVal(formLines, 'L18')} />
      <FormLine num="19" label={getLabel(formLines, 'L19') || 'Other credits'} value={getVal(formLines, 'L19')} />
      <FormLine num="20" label={getLabel(formLines, 'L20') || 'Tax after credits'} value={getVal(formLines, 'L20')} />
      <FormLine num="21" label={getLabel(formLines, 'L21') || ''} value={getVal(formLines, 'L21')} />
      <FormLine num="22" label={getLabel(formLines, 'L22') || ''} value={getVal(formLines, 'L22')} />
      <FormLine num="23" label={getLabel(formLines, 'L23') || ''} value={getVal(formLines, 'L23')} />
      <FormLine num="24" label={getLabel(formLines, 'L24') || ''} value={getVal(formLines, 'L24')} />

      <PartHeader title="Other Taxes" />
      <FormLine num="25" label={getLabel(formLines, 'L25') || ''} value={getVal(formLines, 'L25')} />
      <FormLine num="27" label={getLabel(formLines, 'L27') || ''} value={getVal(formLines, 'L27')} />

      <PartHeader title="Payments" />
      <FormLine num="28" label={getLabel(formLines, 'L28') || ''} value={getVal(formLines, 'L28')} />
      <FormLine num="31" label={getLabel(formLines, 'L31') || ''} value={getVal(formLines, 'L31')} />
      <FormLine num="33" label={getLabel(formLines, 'L33') || ''} value={getVal(formLines, 'L33')} />
      <FormLine num="34" label={getLabel(formLines, 'L34') || ''} value={getVal(formLines, 'L34')} />

      <PartHeader title="Refund or Amount You Owe" />
      <FormLine num="35" label={getLabel(formLines, 'L35') || 'Refund'} value={getVal(formLines, 'L35')} />
      <FormLine num="37" label={getLabel(formLines, 'L37') || ''} value={getVal(formLines, 'L37')} />
      <FormLine num="38" label={getLabel(formLines, 'L38') || 'Amount owed'} value={getVal(formLines, 'L38')} />
      <Disclaimer />
    </Page>
  );
}

/** Render complete Form 1040 as a 2-page PDF Document */
export function Form1040Document(props: Form1040Props): JSX.Element {
  return (
    <Document>
      <Form1040Page1 {...props} />
      <Form1040Page2 formLines={props.formLines} />
    </Document>
  );
}

export default Form1040Document;
