import { NextRequest, NextResponse } from 'next/server';
import { markInvoicePaid } from '@/services/sheetService';

// ─── POST /api/invoices/pay ───────────────────────────────────────────────────

interface PayBody {
  invoiceId: string;
}

/**
 * Marks a single invoice as PAID.
 *
 * The underlying `markInvoicePaid` service function applies a concurrency
 * guard by re-reading the live sheet status before writing, so this endpoint
 * is safe against duplicate submissions from multiple browser tabs.
 *
 * HTTP status codes:
 *   200 — payment recorded successfully
 *   400 — missing invoiceId in body
 *   404 — invoice not found in the sheet
 *   409 — invoice is already marked PAID (guard triggered)
 *   502 — unexpected Sheets API error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body ─────────────────────────────────────────────────────────────
  let body: PayBody;
  try {
    body = (await request.json()) as PayBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'ข้อมูล JSON ไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  const { invoiceId } = body;

  if (!invoiceId?.trim()) {
    return NextResponse.json(
      { success: false, error: 'กรุณาระบุ invoiceId' },
      { status: 400 }
    );
  }

  // 2. Attempt to mark paid ───────────────────────────────────────────────────
  try {
    await markInvoicePaid(invoiceId.trim());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    // Map known service-layer errors to specific HTTP codes.
    if (message.includes('ไม่พบ')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes('ชำระแล้ว')) {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    console.error('[POST /api/invoices/pay]', error);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }

  // 3. Return success ─────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    message: `บันทึกการรับชำระเงินใบแจ้งหนี้ ${invoiceId} เรียบร้อยแล้ว`,
  });
}
