import { NextRequest, NextResponse } from 'next/server';
import { computeInvoiceValues, InvoiceComputeError } from '@/services/invoiceCalculator';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  try {
    const result = await computeInvoiceValues(body);
    return NextResponse.json({ success: true, invoice: { ...result.invoice, ...result } });
  } catch (error) {
    if (error instanceof InvoiceComputeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('[POST /api/invoices/calculate]', error);
    return NextResponse.json({ success: false, error: 'Failed to calculate invoice.' }, { status: 502 });
  }
}
