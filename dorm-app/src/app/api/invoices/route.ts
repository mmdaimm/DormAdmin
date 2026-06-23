import { NextRequest, NextResponse } from 'next/server';
import {
  getRates,
  getRooms,
  getLastInvoiceByRoom,
  calculateArrears,
  saveInvoice,
} from '@/services/sheetService';
import type { Invoice } from '@/types';

// ─── Request body shape ───────────────────────────────────────────────────────

interface CreateInvoiceBody {
  roomId: string;
  roomNumber: string;
  period: string;       // YYYY-MM
  currMeter: number;
  otherBill: number;
  lineToken?: string;   // Optional — omit to skip LINE notification
}

// ─── LINE Notify helper ───────────────────────────────────────────────────────

/**
 * Sends a Thai-language billing summary to a LINE Notify endpoint.
 * Failure is logged but does **not** abort the invoice creation flow.
 */
async function sendLineNotification(
  lineToken: string,
  roomNumber: string,
  period: string,
  total: number
): Promise<void> {
  const message =
    `📢 แจ้งค่าเช่าห้อง ${roomNumber} ประจำเดือน ${period} ` +
    `ยอดรวม: ${total.toLocaleString('th-TH')} บาท`;

  try {
    const params = new URLSearchParams({ message });

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lineToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(
        `[POST /api/invoices] LINE Notify returned ${response.status}: ${text}`
      );
    }
  } catch (error) {
    // Network errors, invalid tokens, etc. must never fail the invoice save.
    console.error('[POST /api/invoices] LINE Notify request failed:', error);
  }
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

  const { roomId, roomNumber, period, currMeter, otherBill, lineToken } = body;

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

  // 8. Send LINE Notify (fire-and-forget, non-blocking) ─────────────────────────
  const effectiveToken = lineToken?.trim() || room.lineToken?.trim();

  if (effectiveToken) {
    // Intentionally not awaited — notification failure must not fail the API.
    void sendLineNotification(effectiveToken, roomNumber, period, totalAmount);
  }

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
