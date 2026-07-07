import { NextRequest, NextResponse } from 'next/server';
import { getAllInvoices, saveInvoice } from '@/services/sheetService';
import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import { computeInvoiceValues, InvoiceComputeError } from '@/services/invoiceCalculator';

interface SaveInvoiceBody {
  roomId: string;
  roomNumber: string;
  period: string;
  currMeter: number;
  otherBill: number;
  proratedAmount?: number;
  pdfUrl: string; // REQUIRED — must be a real, already-uploaded URL
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: SaveInvoiceBody;

  try {
    body = (await request.json()) as SaveInvoiceBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  if (!body.pdfUrl || typeof body.pdfUrl !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid pdfUrl — a real uploaded URL is required.' },
      { status: 400 }
    );
  }

  // Recompute EVERYTHING from raw inputs — never trust financial figures
  // from the client, even ones it echoed back from /calculate a moment ago.
  let computed;
  try {
    computed = await computeInvoiceValues({
      roomId: body.roomId,
      roomNumber: body.roomNumber,
      period: body.period,
      currMeter: body.currMeter,
      otherBill: body.otherBill,
      proratedAmount: body.proratedAmount,
    });
  } catch (error) {
    if (error instanceof InvoiceComputeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('[POST /api/invoices] Failed to compute invoice:', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate invoice.' }, { status: 502 });
  }

  const invoice = { ...computed.invoice, pdfUrl: body.pdfUrl };

  try {
    await saveInvoice(invoice);
  } catch (error) {
    console.error('[POST /api/invoices] Failed to save invoice:', error);
    return NextResponse.json({ success: false, error: 'Failed to save invoice to Google Sheets.' }, { status: 502 });
  }

  if (computed.invoice.creditApplied && computed.invoice.creditApplied > 0) {
    try {
      const roomRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Rooms!A2:F`,
      });
      const roomRows = roomRes.data.values ?? [];
      const roomRowIndex = roomRows.findIndex((r) => String(r[0] ?? '').trim() === body.roomId);
      if (roomRowIndex !== -1) {
        const existingCredit = Math.max(0, parseFloat(String(roomRows[roomRowIndex][4] ?? '')) || 0);
        const roomSheetRow = roomRowIndex + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Rooms!E${roomSheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[existingCredit - computed.invoice.creditApplied]] },
        });
      }
    } catch (error) {
      console.error('[POST /api/invoices] Failed to deduct room credit:', error);
    }
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Invoice saved successfully.',
      invoice: { ...invoice, roomNumber: computed.roomNumber, remainingArrears: computed.remainingArrears },
    },
    { status: 201 }
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    const invoices = await getAllInvoices();
    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error('[GET /api/invoices]', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดข้อมูลบิลได้' },
      { status: 502 }
    );
  }
}
