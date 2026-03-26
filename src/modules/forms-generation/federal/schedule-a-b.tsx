/**
 * Schedule A & B PDF Components
 * Schedule A: Itemized Deductions (medical, taxes, interest, charity, casualty, other)
 * Schedule B: Interest & Ordinary Dividends (payer table format)
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLine, PartHeader, Disclaimer } from './helpers';

interface PayerRow {
  payerName: string;
  amount: number;
}

function PayerTable({ title, rows, totalLabel, totalValue }: {
  title: string;
  rows: PayerRow[];
  totalLabel: string;
  totalValue: number;
}): JSX.Element {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 2 }}>{title}</Text>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2, marginBottom: 2, fontSize: 7 }}>
        <Text style={{ flex: 3 }}>Payer Name</Text>
        <Text style={{ flex: 1, textAlign: 'right' }}>Amount</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', fontSize: 7, paddingVertical: 1 }}>
          <Text style={{ flex: 3 }}>{r.payerName}</Text>
          <Text style={{ flex: 1, textAlign: 'right' }}>{r.amount.toFixed(2)}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', fontSize: 7, paddingVertical: 1, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 2 }}>
        <Text style={{ flex: 3, fontWeight: 'bold' }}>{totalLabel}</Text>
        <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{totalValue.toFixed(2)}</Text>
      </View>
    </View>
  );
}

export function ScheduleADocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule A (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Itemized Deductions -- {taxYear}</Text>

        <PartHeader title="Medical and Dental Expenses" />
        <FormLine num="1" label="Medical and dental expenses" value={formLines['L1']?.value} />
        <FormLine num="2" label="Enter amount from Form 1040, line 11" value={formLines['L2']?.value} />
        <FormLine num="3" label="Multiply line 2 by 7.5% (0.075)" value={formLines['L3']?.value} />
        <FormLine num="4" label="Subtract line 3 from line 1" value={formLines['L4']?.value} />

        <PartHeader title="Taxes You Paid" />
        <FormLine num="5a" label="State and local income taxes" value={formLines['L5a']?.value} />
        <FormLine num="5b" label="State and local real estate taxes" value={formLines['L5b']?.value} />
        <FormLine num="5c" label="State and local personal property taxes" value={formLines['L5c']?.value} />
        <FormLine num="5d" label="Add lines 5a through 5c" value={formLines['L5d']?.value} />
        <FormLine num="5e" label="SALT limit ($10,000)" value={formLines['L5e']?.value} />
        <FormLine num="6" label="Enter smaller of 5d or 5e" value={formLines['L6']?.value} />

        <PartHeader title="Interest You Paid" />
        <FormLine num="8a" label="Home mortgage interest" value={formLines['L8a']?.value} />
        <FormLine num="8b" label="Points not reported on 1098" value={formLines['L8b']?.value} />
        <FormLine num="10" label="Total interest" value={formLines['L10']?.value} />

        <PartHeader title="Gifts to Charity" />
        <FormLine num="11" label="Gifts by cash or check" value={formLines['L11']?.value} />
        <FormLine num="12" label="Gifts other than cash or check" value={formLines['L12']?.value} />
        <FormLine num="14" label="Total charitable contributions" value={formLines['L14']?.value} />

        <PartHeader title="Casualty and Theft Losses" />
        <FormLine num="15" label="Casualty and theft losses" value={formLines['L15']?.value} />

        <PartHeader title="Other Itemized Deductions" />
        <FormLine num="16" label="Other itemized deductions" value={formLines['L16']?.value} />

        <PartHeader title="Total Itemized Deductions" />
        <FormLine num="17" label="Add lines 4, 6, 10, 14, 15, 16" value={formLines['L17']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function ScheduleBDocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  const interestRows: PayerRow[] = [];
  const divRows: PayerRow[] = [];
  let idx = 1;
  while (formLines[`payer_interest_${idx}`]) {
    const entry = formLines[`payer_interest_${idx}`];
    interestRows.push({ payerName: entry.label, amount: entry.value });
    idx++;
  }
  idx = 1;
  while (formLines[`payer_div_${idx}`]) {
    const entry = formLines[`payer_div_${idx}`];
    divRows.push({ payerName: entry.label, amount: entry.value });
    idx++;
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule B (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Interest and Ordinary Dividends -- {taxYear}</Text>

        <PartHeader title="Part I -- Interest" />
        <PayerTable
          title="List name of payer"
          rows={interestRows}
          totalLabel="Total interest"
          totalValue={formLines['L2']?.value ?? 0}
        />
        <FormLine num="2" label="Total taxable interest" value={formLines['L2']?.value} />
        <FormLine num="3" label="Tax-exempt interest" value={formLines['L3']?.value} />

        <PartHeader title="Part II -- Ordinary Dividends" />
        <PayerTable
          title="List name of payer"
          rows={divRows}
          totalLabel="Total ordinary dividends"
          totalValue={formLines['L6']?.value ?? 0}
        />
        <FormLine num="5" label="Total ordinary dividends" value={formLines['L5']?.value} />
        <FormLine num="6" label="Qualified dividends" value={formLines['L6']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}
