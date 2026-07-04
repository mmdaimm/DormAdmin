'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { SlipPdf } from './SlipPdf';
import type { Invoice } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PdfDownloadButtonsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any;
  roomNumber: string;
  /** Electric rate used for the billing calculation (passed through to the PDF template). */
  electricRate?: number;
  mode?: 'INVOICE' | 'RECEIPT' | 'BOTH'; // Default to 'BOTH' for legacy support, but strictly use specific modes moving forward.
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders two PDF download buttons — one for the invoice, one for the receipt.
 *
 * This component MUST stay inside a `dynamic(() => import(...), { ssr: false })`
 * wrapper at the call site so that @react-pdf/renderer is never evaluated by
 * the Turbopack / Next.js SSR compiler (which causes the
 * "ModuleId not found for ident: [externals]/@react-pdf/renderer" error).
 */
export default function PdfDownloadButtons({
  invoice,
  roomNumber,
  electricRate = 5,
  mode = 'BOTH',
}: PdfDownloadButtonsProps) {
  // Guard — the dynamic loading= fallback already handles the null case, but
  // an explicit guard is a second safety net so we never pass a null document
  // to PDFDownloadLink.
  if (!invoice) return null;

  const typedInvoice = invoice as Invoice;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Invoice PDF ── */}
      {(!mode || mode === 'INVOICE' || mode === 'BOTH') && (
        <PDFDownloadLink
          document={
            <SlipPdf
              invoice={typedInvoice}
              roomNumber={roomNumber}
              type="INVOICE"
              electricRate={electricRate}
            />
          }
          fileName={`Invoice-${typedInvoice.invoiceId}.pdf`}
          className="flex items-center justify-center gap-2 w-full py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-900/40"
        >
          {({ loading }) =>
            loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ⏳ กำลังสร้างไฟล์...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  />
                </svg>
                ดาวน์โหลดใบแจ้งหนี้ PDF
              </>
            )
          }
        </PDFDownloadLink>
      )}

      {/* ── Receipt PDF ── */}
      {(mode === 'RECEIPT' || mode === 'BOTH') && (
        <PDFDownloadLink
          document={
            <SlipPdf
              invoice={typedInvoice}
              roomNumber={roomNumber}
              type="RECEIPT"
              electricRate={electricRate}
            />
          }
          fileName={`Receipt-${typedInvoice.invoiceId}.pdf`}
          className="flex items-center justify-center gap-2 w-full py-3 px-5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/40"
        >
          {({ loading }) =>
            loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ⏳ กำลังสร้างไฟล์...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                ดาวน์โหลดใบเสร็จรับเงิน PDF
              </>
            )
          }
        </PDFDownloadLink>
      )}
    </div>
  );
}
