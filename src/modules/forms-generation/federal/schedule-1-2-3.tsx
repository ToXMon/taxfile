/**
 * Schedule 1, 2, 3 PDF Components
 * Schedule 1: Additional Income and Adjustments (Part I + Part II)
 * Schedule 2: Additional Taxes (Part I + Part II)
 * Schedule 3: Additional Credits and Payments (Part I + Part II)
 */

import { Document, Page, Text } from '@react-pdf/renderer';
import type { FormLineMap } from '@/lib/types';
import { styles, FormLineFromMap, PartHeader, Disclaimer } from './helpers';

function renderLines(formLines: FormLineMap, lineKeys: string[]): JSX.Element[] {
  return lineKeys.filter(k => formLines[k] !== undefined).map(k => (
    <FormLineFromMap key={k} map={formLines} lineKey={k} />
  ));
}

export function Schedule1Document({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule 1 (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Additional Income and Adjustments to Income — {taxYear}</Text>
        <PartHeader title="Part I — Additional Income" />
        {renderLines(formLines, ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L10'])}
        <PartHeader title="Part II — Adjustments to Income" />
        {renderLines(formLines, ['L11','L12','L13','L14','L15','L16','L17','L18','L19','L20','L21','L22','L23','L24','L25','L26'])}
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function Schedule2Document({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule 2 (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Additional Taxes — {taxYear}</Text>
        <PartHeader title="Part I — Tax" />
        {renderLines(formLines, ['L1','L2','L3','L4','L5','L6','L7','L8','L9'])}
        <PartHeader title="Part II — Other Taxes" />
        {renderLines(formLines, ['L10','L11','L12','L13','L14','L15','L16','L17'])}
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function Schedule3Document({ formLines, taxYear }: { formLines: FormLineMap; taxYear: number }): JSX.Element {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.formTitle}>Schedule 3 (Form 1040)</Text>
        <Text style={styles.formSubTitle}>Additional Credits and Payments — {taxYear}</Text>
        <PartHeader title="Part I — Nonrefundable Credits" />
        {renderLines(formLines, ['L1','L2','L3','L4','L5','L6','L7','L8'])}
        <PartHeader title="Part II — Other Payments and Refundable Credits" />
        {renderLines(formLines, ['L9','L10','L11','L12','L13','L14','L15'])}
        <Disclaimer />
      </Page>
    </Document>
  );
}
