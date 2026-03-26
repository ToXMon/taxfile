/**
 * Shared PDF rendering helpers for federal form components.
 * Provides consistent layout primitives for @react-pdf/renderer forms.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { FormLineMap, TaxLineItem } from '@/lib/types';

export const COLORS = {
  black: '#000000',
  darkGray: '#333333',
  gray: '#999999',
  lightGray: '#CCCCCC',
  white: '#FFFFFF',
  blue: '#0000CC',
};

export const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: COLORS.black },
  formTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  formSubTitle: { fontSize: 10, textAlign: 'center', marginBottom: 12, color: COLORS.darkGray },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, borderBottomWidth: 0.5, borderColor: COLORS.lightGray },
  lineNum: { width: 30, fontSize: 8, color: COLORS.darkGray },
  lineLabel: { flex: 1, fontSize: 8 },
  lineValue: { width: 80, textAlign: 'right', fontSize: 9, fontFamily: 'Courier' },
  partHeader: { fontSize: 10, fontWeight: 'bold', backgroundColor: COLORS.lightGray, padding: 4, marginTop: 8, marginBottom: 4 },
  disclaimer: { fontSize: 6, color: COLORS.gray, textAlign: 'center', marginTop: 20, position: 'absolute', bottom: 20, left: 36, right: 36 },
  sectionBorder: { borderWidth: 1, borderColor: COLORS.lightGray, padding: 6, marginBottom: 8 },
  bold: { fontWeight: 'bold' },
  rightAlign: { textAlign: 'right' },
});

const DISCLAIMER = 'TaxFile is a self-preparation tool, not professional tax advice. Results should be reviewed by a qualified tax professional before filing.';

/** Format number as currency string */
export function fmt(value: number): string {
  if (value < 0) return `(${Math.abs(value).toLocaleString('en-US')})`;
  return value.toLocaleString('en-US');
}

/** Safely get a TaxLineItem value from FormLineMap */
export function getVal(map: FormLineMap, key: string): number {
  return map[key]?.value ?? 0;
}

/** Safely get a TaxLineItem label from FormLineMap */
export function getLabel(map: FormLineMap, key: string): string {
  return map[key]?.label ?? '';
}

/** Render a single form line with number, label, and value */
export function FormLine({ num, label, value }: { num: string; label: string; value: number }): JSX.Element {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineNum}>{num}</Text>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{fmt(value)}</Text>
    </View>
  );
}

/** Render a form line from FormLineMap key */
export function FormLineFromMap({ map, lineKey }: { map: FormLineMap; lineKey: string }): JSX.Element {
  const item: TaxLineItem = map[lineKey] ?? { value: 0, label: lineKey, source: { documentId: '', formType: '', boxNumber: '' }, trace: {}, flagged: false };
  return <FormLine num={lineKey.replace('L', '')} label={item.label} value={item.value} />;
}

/** Render disclaimer footer */
export function Disclaimer(): JSX.Element {
  return <Text style={styles.disclaimer}>{DISCLAIMER}</Text>;
}

/** Render part header */
export function PartHeader({ title }: { title: string }): JSX.Element {
  return <Text style={styles.partHeader}>{title}</Text>;
}
