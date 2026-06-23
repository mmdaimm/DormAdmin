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
// Sarabun is a Google Font with excellent Thai Unicode coverage.
// We load 3 weights so we can use bold/semibold inside the PDF.

Font.register({
  family: 'Sarabun',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/sarabun/v13/DtVmJx26TKEr37c9YK5silUs.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/sarabun/v13/DtVjJx26TKEr37c9aBBx_nwMxAzephhN.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/sarabun/v13/DtVmJx26TKEr37c9YNZcilUs.ttf',
      fontWeight: 700,
    },
  ],
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 11,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
  },
  dormName: {
    fontSize: 20,
    fontWeight: 700,
    color: '#4f46e5',
  },
  dormSubtitle: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 3,
  },
  docTypeBox: {
    alignItems: 'flex-end',
  },
  docTypeLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  docTypeSubLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  invoiceId: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 4,
  },

  // Meta info grid
  metaGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
  },
  metaLabel: {
    fontSize: 8,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1a1a2e',
  },

  // Table
  tableContainer: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontWeight: 600,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  colDescription: { flex: 3 },
  colDetail: { flex: 2, textAlign: 'center' },
  colAmount: { flex: 1.5, textAlign: 'right' },

  rowText: {
    fontSize: 10,
    color: '#374151',
  },
  arrearsText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: 600,
  },

  // Subtotal separator
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    marginTop: 4,
  },
  subtotalLabel: { flex: 3, fontSize: 10, color: '#6b7280' },
  subtotalValue: { flex: 1.5, textAlign: 'right', fontSize: 10, color: '#6b7280' },

  // Total band
  totalBand: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  totalLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fde68a',
  },

  // Receipt paid stamp
  paidStamp: {
    position: 'absolute',
    top: 160,
    right: 52,
    borderWidth: 3,
    borderColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    transform: 'rotate(-12deg)',
  },
  paidStampText: {
    fontSize: 22,
    fontWeight: 700,
    color: '#16a34a',
    letterSpacing: 3,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  signatureBlock: {
    alignItems: 'center',
    marginTop: 32,
  },
  signatureLine: {
    width: 160,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 9,
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
  // Use monthlyRent from the invoice directly when available (populated by the API).
  // Fall back to back-calculation only for invoices loaded from the sheet directly
  // (where monthlyRent is not stored), with a Math.max(0) guard against drift.
  const rent = invoice.monthlyRent ??
    Math.max(0, invoice.totalAmount - electricBill - invoice.waterBill - invoice.otherBill - invoice.arrears);

  const titleTH = isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
  const titleEN = isReceipt ? 'Receipt' : 'Invoice';

  return (
    <Document
      title={`${titleEN} - ห้อง ${roomNumber} - ${invoice.period}`}
      author="ระบบจัดการหอพัก"
      creator="DormAdmin"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.dormName}>ระบบจัดการหอพัก</Text>
            <Text style={S.dormSubtitle}>Dormitory Management System</Text>
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
            <Text style={[S.tableHeaderCell, S.colDescription]}>รายการ / Description</Text>
            <Text style={[S.tableHeaderCell, S.colDetail]}>รายละเอียด / Detail</Text>
            <Text style={[S.tableHeaderCell, S.colAmount]}>จำนวนเงิน (฿)</Text>
          </View>

          {/* Row: Rent */}
          <View style={S.tableRow}>
            <Text style={[S.rowText, S.colDescription]}>ค่าเช่าห้อง</Text>
            <Text style={[S.rowText, S.colDetail]}>—</Text>
            <Text style={[S.rowText, S.colAmount]}>{fmt(rent)}</Text>
          </View>

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
            <Text style={[S.rowText, S.colDescription]}>ค่าน้ำประปา</Text>
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
          {invoice.arrears > 0 && (
            <View style={S.tableRow}>
              <Text style={[S.arrearsText, S.colDescription]}>ยอดค้างชำระเดือนก่อน</Text>
              <Text style={[S.rowText, S.colDetail]}>—</Text>
              <Text style={[S.arrearsText, S.colAmount]}>{fmt(invoice.arrears)}</Text>
            </View>
          )}

          {/* Subtotal */}
          <View style={S.subtotalRow}>
            <Text style={[S.subtotalLabel, { flex: 5 }]}>รวมทั้งหมด</Text>
            <Text style={S.subtotalValue}>{fmt(invoice.totalAmount)}</Text>
          </View>
        </View>

        {/* ── Total band ── */}
        <View style={S.totalBand}>
          <Text style={S.totalLabel}>
            {isReceipt ? 'ยอดที่ได้รับชำระ' : 'ยอดที่ต้องชำระทั้งหมด'}
          </Text>
          <Text style={S.totalAmount}>
            ฿ {fmt(isReceipt ? invoice.paidAmount : invoice.totalAmount)}
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
            ขอบคุณที่ใช้บริการ | ระบบจัดการหอพัก
          </Text>
          <Text style={S.footerText}>
            สร้างโดย DormAdmin • {new Date().toLocaleDateString('th-TH')}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
