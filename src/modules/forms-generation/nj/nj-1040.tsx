/**
 * NJ-1040 PDF Component
 * NJ Resident Return matching NJ Division of Taxation layout.
 * Renders completed NJ-1040 from CompleteTaxReturn.newJersey.nj1040.
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLine, PartHeader, Disclaimer } from '../federal/helpers';

const NJ_FILING_STATUS: Record<string, string> = {
  single: 'A - Single', mfj: 'C - Married Filing Jointly',
  mfs: 'D - Married Filing Separately', hoh: 'B - Head of Household',
};

interface NJ1040Props {
  formLines: FormLineMap;
  taxYear: number;
  taxpayerName: string;
  ssnMasked: string;
  filingStatus: string;
}

function NJ1040Page1({ formLines, taxYear, taxpayerName, ssnMasked, filingStatus }: NJ1040Props): JSX.Element {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.formTitle}>NJ-1040</Text>
      <Text style={styles.formSubTitle}>New Jersey Resident Income Tax Return -- {taxYear}</Text>
      <View style={{ borderWidth: 1, borderColor: '#CCCCCC', padding: 6, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 8 }}>Your Name: {taxpayerName}</Text>
          <Text style={{ fontSize: 8 }}>SSN: {ssnMasked}</Text>
        </View>
        <Text style={{ fontSize: 8 }}>Filing Status: {NJ_FILING_STATUS[filingStatus] ?? filingStatus}</Text>
      </View>

      <PartHeader title="Income" />
      <FormLine num="1" label="Wages, salaries, tips (W-2)" value={formLines['L1']?.value} />
      <FormLine num="2" label="Taxable interest" value={formLines['L2']?.value} />
      <FormLine num="3" label="Ordinary dividends" value={formLines['L3']?.value} />
      <FormLine num="4" label="Business income (Schedule C)" value={formLines['L4']?.value} />
      <FormLine num="5" label="Capital gain or (loss)" value={formLines['L5']?.value} />
      <FormLine num="6" label="Pension/annuity income" value={formLines['L6']?.value} />
      <FormLine num="7" label="Other income" value={formLines['L7']?.value} />
      <FormLine num="8" label="Total income" value={formLines['L8']?.value} />

      <PartHeader title="Deductions" />
      <FormLine num="9" label="Property taxes paid" value={formLines['L9']?.value} />
      <FormLine num="10" label="Other deductions" value={formLines['L10']?.value} />
      <FormLine num="11" label="Total deductions" value={formLines['L11']?.value} />
      <FormLine num="12" label="Taxable income" value={formLines['L12']?.value} />
      <Disclaimer />
    </Page>
  );
}

function NJ1040Page2({ formLines }: { formLines: FormLineMap }): JSX.Element {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.formTitle}>NJ-1040 (Page 2)</Text>

      <PartHeader title="Tax Computation" />
      <FormLine num="13" label="Tax from tax table or rate schedule" value={formLines['L13']?.value} />
      <FormLine num="14" label="Use tax" value={formLines['L14']?.value} />
      <FormLine num="15" label="Total tax" value={formLines['L15']?.value} />

      <PartHeader title="Credits" />
      <FormLine num="16" label="NJ Earned Income Tax Credit" value={formLines['L16']?.value} />
      <FormLine num="17" label="Property tax credit" value={formLines['L17']?.value} />
      <FormLine num="18" label="Other credits" value={formLines['L18']?.value} />
      <FormLine num="19" label="Total credits" value={formLines['L19']?.value} />
      <FormLine num="20" label="Tax after credits" value={formLines['L20']?.value} />

      <PartHeader title="Payments" />
      <FormLine num="21" label="NJ income tax withheld" value={formLines['L21']?.value} />
      <FormLine num="22" label="Estimated tax payments" value={formLines['L22']?.value} />
      <FormLine num="23" label="Other payments" value={formLines['L23']?.value} />
      <FormLine num="24" label="Total payments" value={formLines['L24']?.value} />

      <PartHeader title="Refund or Amount You Owe" />
      <FormLine num="25" label="Overpayment (refund)" value={formLines['L25']?.value} />
      <FormLine num="26" label="Amount applied to next year" value={formLines['L26']?.value} />
      <FormLine num="27" label="Refund amount" value={formLines['L27']?.value} />
      <FormLine num="28" label="Tax due" value={formLines['L28']?.value} />
      <Disclaimer />
    </Page>
  );
}

export function NJ1040Document(props: NJ1040Props): JSX.Element {
  return (
    <Document>
      <NJ1040Page1 {...props} />
      <NJ1040Page2 formLines={props.formLines} />
    </Document>
  );
}

export default NJ1040Document;
