'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Invoice } from '@/types';

// ─── Thai font registration ───────────────────────────────────────────────────
// Sarabun TTF files are hosted locally under public/fonts/ to avoid GitHub
// rate limits and external CDN 404 errors.
//
// Font.register runs at module load time — which may be in Node.js (SSR/build)
// OR in the browser. We resolve the correct base path for each context:
//   • Node.js  → file://{cwd}/public/fonts  (absolute filesystem path)
//   • Browser  → /fonts                      (Next.js static asset URL)

const fontBase =
  typeof window === 'undefined'
    ? `file://${process.cwd()}/public/fonts`
    : '/fonts';

Font.register({
  family: 'Sarabun',
  fonts: [
    { src: `${fontBase}/Sarabun-Regular.ttf` },
    { src: `${fontBase}/Sarabun-Bold.ttf`, fontWeight: 'bold' },
  ],
});


// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 10,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 36,
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#4f46e5',
  },
  dormName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4f46e5',
  },
  dormSubtitle: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  docTypeBox: {
    alignItems: 'flex-end',
  },
  docTypeLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  docTypeSubLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 1,
  },
  invoiceId: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },

  // Meta info grid
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#f5f3ff',
    borderRadius: 4,
    padding: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#4f46e5',
  },
  metaLabel: {
    fontSize: 7,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1a1a2e',
  },

  // Table
  tableContainer: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontWeight: 600,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  colDescription: {
    paddingLeft: 4,
    flex: 3,
  },
  colDetail: { flex: 2, textAlign: 'center' },
  colAmount: { flex: 1.5, textAlign: 'right' },

  rowText: {
    fontSize: 9,
    color: '#374151',
  },
  arrearsText: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: 600,
  },

  // Subtotal separator
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginTop: 2,
  },
  subtotalLabel: { flex: 3, fontSize: 9, color: '#6b7280' },
  subtotalValue: { flex: 1.5, textAlign: 'right', fontSize: 9, color: '#6b7280' },

  // Total band
  totalBand: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  totalLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fde68a',
  },

  // Receipt paid stamp
  paidStamp: {
    position: 'absolute',
    top: 110,
    right: 36,
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    transform: 'rotate(-12deg)',
  },
  paidStampText: {
    fontSize: 18,
    fontWeight: 700,
    color: '#16a34a',
    letterSpacing: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  signatureBlock: {
    alignItems: 'center',
    marginTop: 44,
  },
  signatureLine: {
    width: 130,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#6b7280',
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Thai month names, 0-indexed (January = index 0). */
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const periodToThai = (period: string): string => {
  const [year, month] = period.split('-');
  return `${THAI_MONTHS[parseInt(month, 10) - 1]} ${parseInt(year, 10) + 543}`;
};

const todayThai = (): string => {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SlipPdfProps {
  invoice: Invoice;
  roomNumber: string;
  /** Render as an invoice (bill to pay) or a receipt (proof of payment). */
  type: 'INVOICE' | 'RECEIPT';
  /** Electric rate used — displayed in the unit detail column. */
  electricRate?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SlipPdf({ invoice, roomNumber, type, electricRate = 5 }: SlipPdfProps) {
  const isReceipt = type === 'RECEIPT';
  const unitsUsed = invoice.currMeter - invoice.prevMeter;
  const electricBill = unitsUsed * electricRate;

  const currentMonthTotal = invoice.isNewFormat 
    ? invoice.totalAmount 
    : invoice.totalAmount - (invoice.arrears || 0);

  const finalProratedAmount = invoice.proratedAmount || (invoice as any).prorated_amount || 0;

  const rent = invoice.monthlyRent ??
    Math.max(0, currentMonthTotal - electricBill - invoice.waterBill - invoice.otherBill + finalProratedAmount);

  const previousArrears = Number(invoice.remainingArrears ?? 0) || 0;
  const creditApplied = Number(invoice.creditApplied ?? (invoice as any).credit_applied ?? 0) || 0;
  const baseTotal = Number(invoice.totalAmount ?? (invoice as any).total_amount ?? 0) || 0;
  
  const grandTotal = baseTotal + previousArrears - creditApplied;

  const titleTH = isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
  const titleEN = isReceipt ? 'Receipt' : 'Invoice';

  return (
    <Document
      title={`${titleEN} - ห้อง ${roomNumber} - ${invoice.period}`}
      author="หอพักดำรงรักษ์"
      creator="DormAdmin"
    >
      <Page size={[595.28, 500]} style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.dormName}>หอพักดำรงรักษ์</Text>
          </View>
          <View style={S.docTypeBox}>
            <Text style={S.docTypeLabel}>{titleTH}</Text>
            <Text style={S.docTypeSubLabel}>{titleEN}</Text>
            <Text style={S.invoiceId}>เลขที่: {invoice.invoiceId}</Text>
          </View>
        </View>

        {/* ── Meta info ── */}
        <View style={S.metaGrid}>
          <View style={S.metaCard}>
            <Text style={S.metaLabel}>ห้อง / Room</Text>
            <Text style={S.metaValue}>ห้อง {roomNumber}</Text>
          </View>
          <View style={S.metaCard}>
            <Text style={S.metaLabel}>ประจำเดือน / Period</Text>
            <Text style={S.metaValue}>{periodToThai(invoice.period)}</Text>
          </View>
          <View style={S.metaCard}>
            <Text style={S.metaLabel}>วันที่ออก / Issue Date</Text>
            <Text style={S.metaValue}>{todayThai()}</Text>
          </View>
        </View>

        {/* ── Billing table ── */}
        <View style={S.tableContainer}>
          {/* Table Header */}
          <View style={S.tableHeader}>
            <Text style={[S.tableHeaderCell, S.colDescription]}> รายการ / Description</Text>
            <Text style={[S.tableHeaderCell, S.colDetail]}> รายละเอียด / Detail</Text>
            <Text style={[S.tableHeaderCell, S.colAmount]}> จำนวนเงิน (฿)</Text>
          </View>

          {/* Row: Rent */}
          <View style={S.tableRow}>
            <Text style={[S.rowText, S.colDescription]}>ค่าเช่าห้อง</Text>
            <Text style={[S.rowText, S.colDetail]}>—</Text>
            <Text style={[S.rowText, S.colAmount]}>{fmt(rent)}</Text>
          </View>

          {/* Row: Prorate (conditional) */}
          {finalProratedAmount > 0 && (
            <View style={S.tableRow}>
              <Text style={[S.rowText, S.colDescription, { color: '#16a34a' }]}>ส่วนลดจากการเข้าพักไม่เต็มเดือน (Pro-rate)</Text>
              <Text style={[S.rowText, S.colDetail]}>—</Text>
              <Text style={[S.rowText, S.colAmount, { color: '#16a34a' }]}>-{fmt(finalProratedAmount)}</Text>
            </View>
          )}

          {/* Row: Electricity */}
          <View style={[S.tableRow, S.tableRowAlt]}>
            <Text style={[S.rowText, S.colDescription]}>ค่าไฟฟ้า</Text>
            <Text style={[S.rowText, S.colDetail]}>
              {invoice.prevMeter} → {invoice.currMeter} ({unitsUsed} หน่วย × {electricRate} ฿)
            </Text>
            <Text style={[S.rowText, S.colAmount]}>{fmt(electricBill)}</Text>
          </View>

          {/* Row: Water */}
          <View style={S.tableRow}>
            <Text style={[S.rowText, S.colDescription]}>ค่าน้ำ </Text>
            <Text style={[S.rowText, S.colDetail]}>อัตราเหมาจ่าย</Text>
            <Text style={[S.rowText, S.colAmount]}>{fmt(invoice.waterBill)}</Text>
          </View>

          {/* Row: Other (conditional) */}
          {invoice.otherBill > 0 && (
            <View style={[S.tableRow, S.tableRowAlt]}>
              <Text style={[S.rowText, S.colDescription]}>ค่าใช้จ่ายอื่น ๆ</Text>
              <Text style={[S.rowText, S.colDetail]}>—</Text>
              <Text style={[S.rowText, S.colAmount]}>{fmt(invoice.otherBill)}</Text>
            </View>
          )}

          {/* Row: Arrears (conditional) */}
          {previousArrears > 0 && (
            <View style={S.tableRow}>
              <Text style={[S.arrearsText, S.colDescription]}>ยอดค้างชำระเดือนก่อน</Text>
              <Text style={[S.rowText, S.colDetail]}>—</Text>
              <Text style={[S.arrearsText, S.colAmount]}>{fmt(previousArrears)}</Text>
            </View>
          )}

          {/* Row: Credit (conditional) */}
          {creditApplied > 0 && (
            <View style={S.tableRow}>
              <Text style={[S.rowText, S.colDescription, { color: '#16a34a' }]}>หักเครดิตสะสม</Text>
              <Text style={[S.rowText, S.colDetail]}>—</Text>
              <Text style={[S.rowText, S.colAmount, { color: '#16a34a' }]}>-{fmt(creditApplied)}</Text>
            </View>
          )}

          {/* Subtotal */}
          <View style={S.subtotalRow}>
            <Text style={[S.subtotalLabel, { flex: 5 }]}>รวมทั้งหมด</Text>
            <Text style={S.subtotalValue}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        <View style={S.totalBand}>
          <Text style={S.totalLabel}>
            {isReceipt ? 'ยอดที่ได้รับชำระ' : 'ยอดที่ต้องชำระทั้งหมด'}
          </Text>
          <Text style={S.totalAmount}>
            ฿ {fmt(isReceipt ? invoice.paidAmount : grandTotal)}
          </Text>
        </View>

        {/* ── Paid stamp (receipt only) ── */}
        {isReceipt && (
          <View style={S.paidStamp}>
            <Text style={S.paidStampText}>ชำระแล้ว</Text>
          </View>
        )}

        {/* ── Signature block ── */}
        <View style={S.signatureBlock}>
          <View style={S.signatureLine} />
          <Text style={S.signatureLabel}>
            {isReceipt ? 'ผู้รับเงิน / Received by' : 'ผู้ออกใบแจ้งหนี้ / Issued by'}
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            ขอบคุณที่ใช้บริการ หอพักดำรงรักษ์
          </Text>
          <Text style={S.footerText}>
            สร้างโดย DormAdmin • {new Date().toLocaleDateString('th-TH')}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
