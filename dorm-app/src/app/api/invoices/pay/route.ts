import { NextRequest, NextResponse } from 'next/server';
import { messagingApi } from '@line/bot-sdk';
import { markInvoicePaid, getTenants, getRooms } from '@/services/sheetService';

// ─── LINE Messaging API client (lazy) ────────────────────────────────────────

function getLineClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  });
}

// ─── POST /api/invoices/pay ───────────────────────────────────────────────────

interface PayBody {
  invoiceId: string;
}

/**
 * Marks a single invoice as PAID.
 *
 * The underlying `markInvoicePaid` service function:
 *   • Applies a concurrency guard (re-reads live status before writing).
 *   • Returns `{ roomId, totalAmount }` extracted from the row already in
 *     memory, so we do NOT fetch the Invoices sheet a second time.
 *
 * After marking paid, we concurrently fetch Tenants + Rooms to resolve the
 * active tenant's lineUserId and the room's display number, then push a
 * receipt notification via the LINE Messaging API (fire-and-forget).
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

  // 2. Mark invoice as paid — returns roomId & totalAmount from in-memory row ──
  let roomId: string;
  let totalAmount: number;

  try {
    ({ roomId, totalAmount } = await markInvoicePaid(invoiceId.trim()));
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

  // 3. Push LINE receipt notification (fire-and-forget, non-blocking) ──────────
  //    Reuses roomId + totalAmount returned by markInvoicePaid — no second
  //    Invoices sheet fetch. Fetches Tenants + Rooms concurrently (2 calls).
  void (async () => {
    try {
      const [tenants, rooms] = await Promise.all([getTenants(), getRooms()]);

      const tenant = tenants.find(
        (t) => t.room_id === roomId && t.status === 'ACTIVE'
      );
      const room = rooms.find((r) => r.roomId === roomId);
      const roomNumber = room?.roomNumber ?? roomId;

      if (tenant?.lineUserId) {
        const lineMessage =
          `✅ ได้รับชำระเงินค่าห้อง ${roomNumber} จำนวน ${totalAmount.toLocaleString('th-TH')} บาท เรียบร้อยแล้ว\n` +
          `ขอบคุณค่ะ 😊`;

        try {
          await getLineClient().pushMessage({
            to: tenant.lineUserId,
            messages: [{ type: 'text', text: lineMessage }],
          });
        } catch (lineError) {
          console.error('[LINE Push Failed - Mark Paid]', {
            invoiceId,
            lineUserId: tenant.lineUserId,
            error: lineError,
          });
        }
      }
    } catch (fetchError) {
      // Tenant/rooms fetch failure must not surface to the client.
      console.error('[POST /api/invoices/pay] Failed to fetch data for LINE push:', fetchError);
    }
  })();

  // 4. Return success ──────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    message: `บันทึกการรับชำระเงินใบแจ้งหนี้ ${invoiceId} เรียบร้อยแล้ว`,
  });
}
