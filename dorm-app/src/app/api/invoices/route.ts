import { NextRequest, NextResponse } from 'next/server';
import {
  getRates,
  getRooms,
  getAllInvoices,
  calculateArrears,
  saveInvoice,
} from '@/services/sheetService';
import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import type { Invoice } from '@/types';

// ─── Request body shape ───────────────────────────────────────────────────────

interface CreateInvoiceBody {
  roomId: string;
  roomNumber: string;
  period: string;       // YYYY-MM
  currMeter: number;
  otherBill: number;
  pdfUrl?: string;
  proratedAmount?: number;
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

  const { roomId, roomNumber, period, currMeter, otherBill, pdfUrl, proratedAmount = 0 } = body;

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
  let allInvoices: Awaited<ReturnType<typeof getAllInvoices>>;

  try {
    [rates, rooms, allInvoices] = await Promise.all([
      getRates(),
      getRooms(),
      getAllInvoices(),
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
  const roomInvoices = allInvoices.filter(inv => inv.roomId === roomId);
  const isDuplicate = roomInvoices.some(inv => inv.period === period);
  
  if (isDuplicate) {
    return NextResponse.json(
      {
        success: false,
        error: `ห้อง ${roomNumber} ได้ออกใบแจ้งหนี้ประจำเดือน ${period} ไปเรียบร้อยแล้ว`,
      },
      { status: 409 }
    );
  }

  // 3b. Find the "Previous Invoice" (Sort by period DESC, NOT current period) ──
  const previousInvoices = roomInvoices
    .filter(inv => inv.period !== period && inv.status !== 'CANCELLED' as any && inv.status !== 'VOID' as any)
    .sort((a, b) => b.period.localeCompare(a.period));
    
  const lastInvoice = previousInvoices.length > 0 ? previousInvoices[0] : null;

  // 4. Resolve previous meter reading ──────────────────────────────────────────
  const prevMeter = lastInvoice ? (parseFloat(lastInvoice.currMeter as any ?? (lastInvoice as any).curr_meter ?? 0) || 0) : 0;

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

  const currentMonthTotal = (room.monthlyRent - proratedAmount) + electricityBill + waterBill + otherBill;
  const preliminaryTotal = currentMonthTotal + arrears;
  const creditBalance = room.creditBalance ?? 0;
  
  const creditApplied = Math.min(preliminaryTotal, creditBalance);
  const grandTotal = preliminaryTotal - creditApplied;

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
    totalAmount: currentMonthTotal, // MUST store ONLY current_month_total
    paidAmount: 0,
    status: 'UNPAID',
    pdfUrl,
    creditApplied,
    isNewFormat: true,
    proratedAmount,
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

  // 8. Deduct used credit from the Room
  if (creditApplied > 0) {
    try {
      const roomRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Rooms!A2:F`,
      });
      const roomRows = roomRes.data.values ?? [];
      const roomRowIndex = roomRows.findIndex((r) => String(r[0] ?? '').trim() === roomId);
      if (roomRowIndex !== -1) {
        const existingCredit = Math.max(0, parseFloat(String(roomRows[roomRowIndex][4] ?? '')) || 0);
        const roomSheetRow = roomRowIndex + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Rooms!E${roomSheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[existingCredit - creditApplied]] },
        });
      }
    } catch (error) {
      console.error('[POST /api/invoices] Failed to deduct room credit:', error);
    }
  }  // 9. Return success ───────────────────────────────────────────────────────────
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
        paidAmount: invoice.paidAmount,
        monthlyRent: room.monthlyRent,
        status: invoice.status,
        creditApplied: invoice.creditApplied,
        isNewFormat: invoice.isNewFormat,
        proratedAmount: invoice.proratedAmount,
        remainingArrears: invoice.arrears,
        grandTotal, // For frontend UI
      },
    },
    { status: 201 }
  );
}
