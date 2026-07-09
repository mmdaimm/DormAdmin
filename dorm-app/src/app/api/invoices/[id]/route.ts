// DEPRECATED: no longer called after the invoice-save flow was redesigned
// to write to Google Sheets only after PDF upload succeeds (see
// /api/invoices/calculate and /api/invoices for the current flow).
// Safe to delete once confirmed no client code references this route.
import { NextRequest, NextResponse } from 'next/server';
import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import { SHEET_SETTINGS } from '@/services/sheetService'; // Wait, let's just use string literal 'Invoices'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const invoiceId = (await params).id;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'Missing invoice ID' }, { status: 400 });
    }

    const body = await request.json();
    const { url_invoice } = body;

    if (url_invoice === undefined) {
      return NextResponse.json({ success: false, error: 'Missing url_invoice' }, { status: 400 });
    }

    // 1. Fetch column A to find the invoiceId rowIndex
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Invoices!A:A',
    });

    const rows = response.data.values ?? [];
    const rowIndex = rows.findIndex((row) => String(row[0] ?? '').trim() === invoiceId);

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    // Google Sheets rows are 1-indexed, and rows from API are 0-indexed in array.
    // rowIndex in array maps to rowIndex + 1 in the sheet.
    const sheetRow = rowIndex + 1;

    // 2. Safely update ONLY Column L (Index 11, url_invoice)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Invoices!L${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[url_invoice]] },
    });

    return NextResponse.json({ success: true, message: 'PDF URL updated successfully' });
  } catch (error) {
    console.error('[PATCH /api/invoices/[id]] Error updating invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update invoice URL' },
      { status: 502 }
    );
  }
}
