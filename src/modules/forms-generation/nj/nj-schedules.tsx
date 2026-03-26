/**
 * NJ Schedule A, B, C PDF Components
 * Schedule A: NJ Itemized Deductions
 * Schedule B: NJ Interest and Dividends (payer lists)
 * Schedule C: NJ Business Income
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLine, PartHeader, Disclaimer } from '../federal/helpers';

export function NJScheduleADocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>NJ Schedule A</Text>
        <Text style={styles.formSubTitle}>Itemized Deductions -- {taxYear}</Text>

        <PartHeader title="Medical Expenses" />
        <FormLine num="1" label="Medical and dental expenses" value={formLines['L1']?.value} />
        <FormLine num="2" label="Enter amount from NJ-1040, line 12" value={formLines['L2']?.value} />
        <FormLine num="3" label="Multiply line 2 by 2% (0.02)" value={formLines['L3']?.value} />
        <FormLine num="4" label="Subtract line 3 from line 1" value={formLines['L4']?.value} />

        <PartHeader title="Property Taxes" />
        <FormLine num="5" label="Property taxes paid on residence" value={formLines['L5']?.value} />
        <FormLine num="6" label="Property taxes paid on other real estate" value={formLines['L6']?.value} />
        <FormLine num="7" label="Total property taxes" value={formLines['L7']?.value} />

        <PartHeader title="Interest Paid" />
        <FormLine num="8" label="Mortgage interest on residence" value={formLines['L8']?.value} />
        <FormLine num="9" label="Other mortgage interest" value={formLines['L9']?.value} />
        <FormLine num="10" label="Total interest" value={formLines['L10']?.value} />

        <PartHeader title="Charitable Contributions" />
        <FormLine num="11" label="Cash contributions" value={formLines['L11']?.value} />
        <FormLine num="12" label="Non-cash contributions" value={formLines['L12']?.value} />
        <FormLine num="13" label="Total contributions" value={formLines['L13']?.value} />

        <PartHeader title="Total Deductions" />
        <FormLine num="14" label="Add lines 4, 7, 10, 13" value={formLines['L14']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function NJScheduleBDocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  const interestRows: Array<{ name: string; amount: number }> = [];
  const divRows: Array<{ name: string; amount: number }> = [];
  let idx = 1;
  while (formLines[`nj_payer_int_${idx}`]) {
    const e = formLines[`nj_payer_int_${idx}`];
    interestRows.push({ name: e.label, amount: e.value });
    idx++;
  }
  idx = 1;
  while (formLines[`nj_payer_div_${idx}`]) {
    const e = formLines[`nj_payer_div_${idx}`];
    divRows.push({ name: e.label, amount: e.value });
    idx++;
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>NJ Schedule B</Text>
        <Text style={styles.formSubTitle}>Interest and Dividend Income -- {taxYear}</Text>

        <PartHeader title="Part I -- Interest Income" />
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', fontSize: 7, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2, marginBottom: 2 }}>
            <Text style={{ flex: 3 }}>Payer Name</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Amount</Text>
          </View>
          {interestRows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', fontSize: 7, paddingVertical: 1 }}>
              <Text style={{ flex: 3 }}>{r.name}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{r.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
        <FormLine num="1" label="Total taxable interest" value={formLines['L1']?.value} />
        <FormLine num="2" label="Tax-exempt interest" value={formLines['L2']?.value} />

        <PartHeader title="Part II -- Dividend Income" />
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', fontSize: 7, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2, marginBottom: 2 }}>
            <Text style={{ flex: 3 }}>Payer Name</Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>Amount</Text>
          </View>
          {divRows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', fontSize: 7, paddingVertical: 1 }}>
              <Text style={{ flex: 3 }}>{r.name}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{r.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
        <FormLine num="3" label="Total ordinary dividends" value={formLines['L3']?.value} />
        <FormLine num="4" label="Qualified dividends" value={formLines['L4']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function NJScheduleCDocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>NJ Schedule C</Text>
        <Text style={styles.formSubTitle}>Business Income -- {taxYear}</Text>

        <View style={{ borderWidth: 1, borderColor: '#CCCCCC', padding: 6, marginBottom: 8 }}>
          <Text style={{ fontSize: 8, marginBottom: 2 }}>Name of business: {formLines['business_name']?.label ?? ''}</Text>
          <Text style={{ fontSize: 8 }}>Principal business activity: {formLines['business_activity']?.label ?? ''}</Text>
        </View>

        <PartHeader title="Income" />
        <FormLine num="1" label="Gross receipts or sales" value={formLines['L1']?.value} />
        <FormLine num="2" label="Returns and allowances" value={formLines['L2']?.value} />
        <FormLine num="3" label="Net receipts or sales" value={formLines['L3']?.value} />
        <FormLine num="4" label="Other income" value={formLines['L4']?.value} />
        <FormLine num="5" label="Gross profit" value={formLines['L5']?.value} />

        <PartHeader title="Expenses" />
        <FormLine num="6" label="Advertising" value={formLines['L6']?.value} />
        <FormLine num="7" label="Car and truck expenses" value={formLines['L7']?.value} />
        <FormLine num="8" label="Commissions and fees" value={formLines['L8']?.value} />
        <FormLine num="9" label="Insurance" value={formLines['L9']?.value} />
        <FormLine num="10" label="Legal and professional services" value={formLines['L10']?.value} />
        <FormLine num="11" label="Office expense" value={formLines['L11']?.value} />
        <FormLine num="12" label="Rent or lease" value={formLines['L12']?.value} />
        <FormLine num="13" label="Supplies" value={formLines['L13']?.value} />
        <FormLine num="14" label="Travel" value={formLines['L14']?.value} />
        <FormLine num="15" label="Utilities" value={formLines['L15']?.value} />
        <FormLine num="16" label="Other expenses" value={formLines['L16']?.value} />
        <FormLine num="17" label="Total expenses" value={formLines['L17']?.value} />

        <PartHeader title="Net Income" />
        <FormLine num="18" label="Net profit or (loss)" value={formLines['L18']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}
