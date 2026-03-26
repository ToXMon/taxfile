/**
 * Schedule D + Schedule 8812 PDF Components
 * Schedule D: Capital Gains and Losses (short/long-term transaction tables)
 * Schedule 8812: Credits for Qualifying Children and Other Dependents (CTC)
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLine, PartHeader, Disclaimer } from './helpers';

interface TransactionRow {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  gain: number;
}

function TransactionTable({ rows, totalProceeds, totalCost, totalGain }: {
  rows: TransactionRow[];
  totalProceeds: number;
  totalCost: number;
  totalGain: number;
}): JSX.Element {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', fontSize: 6, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 2, marginBottom: 2 }}>
        <Text style={{ flex: 3 }}>Description</Text>
        <Text style={{ flex: 1 }}>Acquired</Text>
        <Text style={{ flex: 1 }}>Sold</Text>
        <Text style={{ flex: 1, textAlign: 'right' }}>Proceeds</Text>
        <Text style={{ flex: 1, textAlign: 'right' }}>Cost</Text>
        <Text style={{ flex: 1, textAlign: 'right' }}>Gain/(Loss)</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', fontSize: 6, paddingVertical: 1 }}>
          <Text style={{ flex: 3 }}>{r.description}</Text>
          <Text style={{ flex: 1 }}>{r.dateAcquired}</Text>
          <Text style={{ flex: 1 }}>{r.dateSold}</Text>
          <Text style={{ flex: 1, textAlign: 'right' }}>{r.proceeds.toFixed(2)}</Text>
          <Text style={{ flex: 1, textAlign: 'right' }}>{r.costBasis.toFixed(2)}</Text>
          <Text style={{ flex: 1, textAlign: 'right' }}>{r.gain >= 0 ? r.gain.toFixed(2) : `(${Math.abs(r.gain).toFixed(2)})`}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', fontSize: 6, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 2 }}>
        <Text style={{ flex: 5 }}></Text>
        <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{totalProceeds.toFixed(2)}</Text>
        <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{totalCost.toFixed(2)}</Text>
        <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{totalGain >= 0 ? totalGain.toFixed(2) : `(${Math.abs(totalGain).toFixed(2)})`}</Text>
      </View>
    </View>
  );
}

function extractTransactions(formLines: FormLineMap, prefix: string): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let idx = 1;
  while (formLines[`${prefix}_${idx}`]) {
    const e = formLines[`${prefix}_${idx}`];
    const parts = e.label.split('|');
    rows.push({
      description: parts[0] ?? '',
      dateAcquired: parts[1] ?? '',
      dateSold: parts[2] ?? '',
      proceeds: formLines[`${prefix}_${idx}_proceeds`]?.value ?? 0,
      costBasis: formLines[`${prefix}_${idx}_cost`]?.value ?? 0,
      gain: e.value,
    });
    idx++;
  }
  return rows;
}

export function ScheduleDDocument({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  const shortRows = extractTransactions(formLines, 'short_term');
  const longRows = extractTransactions(formLines, 'long_term');

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule D (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Capital Gains and Losses -- {taxYear}</Text>

        <PartHeader title="Part I -- Short-Term Capital Gains and Losses" />
        <TransactionTable
          rows={shortRows}
          totalProceeds={formLines['short_total_proceeds']?.value ?? 0}
          totalCost={formLines['short_total_cost']?.value ?? 0}
          totalGain={formLines['L1']?.value ?? 0}
        />
        <FormLine num="1" label="Total short-term gain/(loss)" value={formLines['L1']?.value} />
        <FormLine num="2" label="Short-term gain from Form 4797" value={formLines['L2']?.value} />
        <FormLine num="3" label="Net short-term gain/(loss)" value={formLines['L3']?.value} />
        <FormLine num="4" label="Short-term loss carryover" value={formLines['L4']?.value} />
        <FormLine num="5" label="Net short-term gain/(loss) after carryover" value={formLines['L5']?.value} />
        <FormLine num="6" label="Net short-term capital gain" value={formLines['L6']?.value} />

        <PartHeader title="Part II -- Long-Term Capital Gains and Losses" />
        <TransactionTable
          rows={longRows}
          totalProceeds={formLines['long_total_proceeds']?.value ?? 0}
          totalCost={formLines['long_total_cost']?.value ?? 0}
          totalGain={formLines['L8']?.value ?? 0}
        />
        <FormLine num="8" label="Total long-term gain/(loss)" value={formLines['L8']?.value} />
        <FormLine num="9" label="Long-term gain from Form 4797" value={formLines['L9']?.value} />
        <FormLine num="10" label="Net long-term gain/(loss)" value={formLines['L10']?.value} />
        <FormLine num="11" label="Long-term loss carryover" value={formLines['L11']?.value} />
        <FormLine num="12" label="Net long-term gain/(loss) after carryover" value={formLines['L12']?.value} />
        <FormLine num="13" label="Net long-term capital gain" value={formLines['L13']?.value} />

        <PartHeader title="Part III -- Summary" />
        <FormLine num="15" label="Combine lines 5 and 12" value={formLines['L15']?.value} />
        <FormLine num="16" label="If line 15 is a gain, enter gain" value={formLines['L16']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function Schedule8812Document({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule 8812 (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Credits for Qualifying Children and Other Dependents -- {taxYear}</Text>

        <PartHeader title="Part I -- Child Tax Credit and Credit for Other Dependents" />
        <FormLine num="1" label="Enter amount from Form 1040, line 11" value={formLines['L1']?.value} />
        <FormLine num="2" label="Multiply line 1 by $2,000" value={formLines['L2']?.value} />
        <FormLine num="3" label="Number of qualifying children under 17" value={formLines['L3']?.value} />
        <FormLine num="4" label="Multiply line 3 by $2,000" value={formLines['L4']?.value} />
        <FormLine num="5" label="Number of other dependents" value={formLines['L5']?.value} />
        <FormLine num="6" label="Multiply line 5 by $500" value={formLines['L6']?.value} />
        <FormLine num="7" label="Add lines 4 and 6" value={formLines['L7']?.value} />
        <FormLine num="8" label="Enter smaller of line 2 or line 7" value={formLines['L8']?.value} />
        <FormLine num="9" label="Subtract line 8 from line 2" value={formLines['L9']?.value} />

        <PartHeader title="Part II-A -- Refundable Child Tax Credit" />
        <FormLine num="11" label="Enter amount from Form 1040, line 18" value={formLines['L11']?.value} />
        <FormLine num="12" label="Subtract line 8 from line 11" value={formLines['L12']?.value} />
        <FormLine num="13" label="Enter $2,500" value={formLines['L13']?.value} />
        <FormLine num="14" label="Enter smaller of line 12 or line 13" value={formLines['L14']?.value} />
        <FormLine num="15" label="Multiply line 14 by 15% (0.15)" value={formLines['L15']?.value} />
        <FormLine num="16" label="Multiply line 3 by $1,700" value={formLines['L16']?.value} />
        <FormLine num="17" label="Enter smaller of line 15 or line 16" value={formLines['L17']?.value} />
        <FormLine num="18" label="Add lines 8 and 17" value={formLines['L18']?.value} />
        <FormLine num="19" label="Enter amount from Form 1040, line 24" value={formLines['L19']?.value} />
        <FormLine num="20" label="Enter smaller of line 18 or line 19" value={formLines['L20']?.value} />
        <FormLine num="21" label="Subtract line 20 from line 18" value={formLines['L21']?.value} />
        <Disclaimer />
      </Page>
    </Document>
  );
}
