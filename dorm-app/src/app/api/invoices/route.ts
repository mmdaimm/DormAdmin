import { NextRequest, NextResponse } from 'next/server';
import { messagingApi } from '@line/bot-sdk';
import {
  getRates,
  getRooms,
  getLastInvoiceByRoom,
  calculateArrears,
  saveInvoice,
  getTenants,
} from '@/services/sheetService';
import type { Invoice } from '@/types';

// ─── Request body shape ───────────────────────────────────────────────────────

interface CreateInvoiceBody {
  roomId: string;
  roomNumber: string;
  period: string;       // YYYY-MM
  currMeter: number;
  otherBill: number;
}

// ─── LINE Messaging API client (lazy singleton) ───────────────────────────────

/**
 * Returns a MessagingApiClient using the channel access token from env.
 * Initialised lazily so missing env vars only error at runtime (not at build).
 */
function getLineClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  });
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse and validate the request body ─────────────────────────────────────
  let body: CreateInvoiceBody;

  try {
    body = (await request.json()) as CreateInvoiceBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body.' },
      { status: 400 }
    );
  }

  const { roomId, roomNumber, period, currMeter, otherBill } = body;

  if (!roomId || !roomNumber || !period || currMeter === undefined || otherBill === undefined) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Missing required fields: roomId, roomNumber, period, currMeter, otherBill.',
      },
      { status: 400 }
    );
  }

  // Validate period format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { success: false, error: 'Field "period" must match the format YYYY-MM.' },
      { status: 400 }
    );
  }

  // 2. Fetch all data concurrently ──────────────────────────────────────────────
  let rates: Awaited<ReturnType<typeof getRates>>;
  let rooms: Awaited<ReturnType<typeof getRooms>>;
  let lastInvoice: Awaited<ReturnType<typeof getLastInvoiceByRoom>>;

  try {
    [rates, rooms, lastInvoice] = await Promise.all([
      getRates(),
      getRooms(),
      getLastInvoiceByRoom(roomId),
    ]);
  } catch (error) {
    console.error('[POST /api/invoices] Failed to fetch sheet data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve data from Google Sheets.' },
      { status: 502 }
    );
  }

  // 3. Look up the room record ──────────────────────────────────────────────────
  const room = rooms.find((r) => r.roomId === roomId);

  if (!room) {
    return NextResponse.json(
      { success: false, error: `Room with roomId "${roomId}" not found.` },
      { status: 404 }
    );
  }

  // 3a. Guard against duplicate billing for the same room+period ──────────────
  if (lastInvoice?.period === period) {
    return NextResponse.json(
      {
        success: false,
        error: `ห้อง ${roomNumber} ได้ออกใบแจ้งหนี้ประจำเดือน ${period} ไปเรียบร้อยแล้ว`,
      },
      { status: 409 }
    );
  }

  // 4. Resolve previous meter reading ──────────────────────────────────────────
  const prevMeter = lastInvoice?.currMeter ?? 0;

  if (currMeter < prevMeter) {
    return NextResponse.json(
      {
        success: false,
        error: `currMeter (${currMeter}) cannot be less than prevMeter (${prevMeter}).`,
      },
      { status: 422 }
    );
  }

  // 5. Calculate billing amounts ────────────────────────────────────────────────
  const unitsUsed = currMeter - prevMeter;
  const electricityBill = unitsUsed * rates.electricRate;
  const waterBill = rates.waterRate;
  const arrears = calculateArrears(lastInvoice);

  const totalAmount =
    room.monthlyRent + electricityBill + waterBill + otherBill + arrears;

  // 6. Build the invoice object ─────────────────────────────────────────────────
  // Invoice ID: INV-{roomId}-{period} — unique per room per billing period.
  const invoiceId = `INV-${roomId}-${period}`;

  const invoice: Invoice = {
    invoiceId,
    roomId,
    period,
    prevMeter,
    currMeter,
    waterBill,
    otherBill,
    arrears,
    totalAmount,
    paidAmount: 0,        // Brand-new invoice — no payment received yet.
    status: 'UNPAID',
  };

  // 7. Persist the invoice ──────────────────────────────────────────────────────
  try {
    await saveInvoice(invoice);
  } catch (error) {
    console.error('[POST /api/invoices] Failed to save invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save invoice to Google Sheets.' },
      { status: 502 }
    );
  }

  // 8. Push LINE Messaging API notification (fire-and-forget, non-blocking) ─────
  //    Tenant lookup is done AFTER save so invoice creation is never delayed.
  void (async () => {
    try {
      const tenants = await getTenants();
      const tenant = tenants.find(
        (t) => t.room_id === roomId && t.status === 'ACTIVE'
      );

      if (tenant?.lineUserId) {
        const lineMessage =
          `📄 แจ้งค่าเช่าห้อง ${roomNumber} ประจำเดือน ${period}\n` +
          `ยอดรวม: ${totalAmount.toLocaleString('th-TH')} บาท\n\n` +
          `สามารถโอนเงินและส่งสลิปเข้ามาในแชทนี้ได้เลยค่ะ 😊`;

        try {
          await getLineClient().pushMessage({
            to: tenant.lineUserId,
            messages: [{ type: 'text', text: lineMessage }],
          });
        } catch (lineError) {
          console.error('[LINE Push Failed - Create Invoice]', {
            invoiceId: invoice.invoiceId,
            lineUserId: tenant.lineUserId,
            error: lineError,
          });
        }
      }
    } catch (tenantFetchError) {
      // Tenant fetch failure must not surface to the client.
      console.error('[POST /api/invoices] Failed to fetch tenants for LINE push:', tenantFetchError);
    }
  })();

  // 9. Return success ───────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      success: true,
      message: 'Invoice created successfully.',
      invoice: {
        invoiceId: invoice.invoiceId,
        roomId: invoice.roomId,
        roomNumber,
        period: invoice.period,
        prevMeter: invoice.prevMeter,
        currMeter: invoice.currMeter,
        unitsUsed,
        electricityBill,
        waterBill: invoice.waterBill,
        otherBill: invoice.otherBill,
        arrears: invoice.arrears,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,   // ← required by SlipPdf for receipt rendering
        monthlyRent: room.monthlyRent,    // ← avoids floating-point drift in SlipPdf rent display
        status: invoice.status,
      },
    },
    { status: 201 }
  );
}
