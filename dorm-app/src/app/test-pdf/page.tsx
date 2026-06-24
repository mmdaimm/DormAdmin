'use client';

import dynamic from 'next/dynamic';
import { SlipPdf } from '@/components/pdf/SlipPdf';
import type { Invoice } from '@/types';

// PDFViewer is browser-only — must be excluded from SSR to avoid the
// "PDFViewer is a web specific API" Turbopack build error.
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

// ─── Mock data satisfying ALL Invoice interface fields ────────────────────────
// Strictly typed — TypeScript will error if any required field is missing.

const mockInvoice: Invoice = {
  invoiceId:    'INV-R01-2567-06',
  roomId:       'R01',
  period:       '2567-06',
  prevMeter:    1240,
  currMeter:    1318,
  waterBill:    100,
  otherBill:    0,
  arrears:      0,
  totalAmount:  3690,   // 3000 rent + 78 units × 7.5 ฿ + 100 water
  paidAmount:   0,
  monthlyRent:  3000,   // optional field — populated here for accurate PDF render
  status:       'UNPAID',
};

const mockRoomNumber = '101';

// ─── PDF Playground ───────────────────────────────────────────────────────────
// Developer-only route: /test-pdf
// Renders a live PDFViewer in-browser for rapid SlipPdf iteration.

export default function TestPdfPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-slate-950">

      {/* Dev toolbar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-700">
        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">
          🛠 PDF Playground — dev only
        </span>
        <span className="text-xs text-slate-500">
          ห้อง {mockRoomNumber} · INV {mockInvoice.invoiceId} · ฿ {mockInvoice.totalAmount.toLocaleString()}
        </span>
        <div className="ml-auto flex gap-2">
          <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded font-mono">type=INVOICE</span>
          <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded font-mono">type=RECEIPT</span>
        </div>
      </div>

      {/* Full-screen PDF viewer split: Invoice | Receipt */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Invoice */}
        <div className="flex-1 flex flex-col border-r border-slate-800">
          <p className="text-xs text-center text-slate-500 py-1.5 bg-slate-900/50 border-b border-slate-800">
            ใบแจ้งหนี้ (Invoice)
          </p>
          <div className="flex-1">
            <PDFViewer className="w-full h-full" showToolbar={false}>
              <SlipPdf
                invoice={mockInvoice}
                roomNumber={mockRoomNumber}
                type="INVOICE"
                electricRate={7.5}
              />
            </PDFViewer>
          </div>
        </div>

        {/* Right: Receipt */}
        <div className="flex-1 flex flex-col">
          <p className="text-xs text-center text-slate-500 py-1.5 bg-slate-900/50 border-b border-slate-800">
            ใบเสร็จรับเงิน (Receipt)
          </p>
          <div className="flex-1">
            <PDFViewer className="w-full h-full" showToolbar={false}>
              <SlipPdf
                invoice={{ ...mockInvoice, paidAmount: mockInvoice.totalAmount, status: 'PAID' }}
                roomNumber={mockRoomNumber}
                type="RECEIPT"
                electricRate={7.5}
              />
            </PDFViewer>
          </div>
        </div>

      </div>
    </div>
  );
}
