import { NextResponse } from 'next/server';
import { getRooms, getAllInvoices } from '@/services/sheetService';

/**
 * GET /api/rooms
 *
 * Returns every room enriched with `prevMeter` and `lastStatus` derived from
 * the room's most recent invoice.
 *
 * Performance: exactly 2 Google Sheets API calls regardless of room count
 * (previously N+1 calls — one getRooms + one getLastInvoiceByRoom per room).
 *
 *   Call 1 → getRooms()       reads "Rooms" sheet
 *   Call 2 → getAllInvoices() reads entire "Invoices" sheet once
 *
 * Rooms are then enriched entirely in RAM: invoices are filtered by roomId,
 * the last matching row (most recently appended) is used as the source of
 * prevMeter and lastStatus.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // ── 2 concurrent Sheets calls ──────────────────────────────────────────────
    const [rooms, allInvoices] = await Promise.all([
      getRooms(),
      getAllInvoices(),
    ]);

    // ── In-memory enrichment ───────────────────────────────────────────────────
    const enriched = rooms.map((room) => {
      // Filter all invoices for this room (excluding cancelled/void), then sort
      // by period descending and take the first. This relies on the invariant
      // that each room has at most one invoice per period (enforced by the
      // duplicate-check in computeInvoiceValues), so sorting by period is a
      // safe way to find the latest — unlike Tenants, which has no such
      // uniqueness guarantee and must rely on append-order instead.
      const roomInvoices = allInvoices.filter((inv) => inv.roomId === room.roomId && inv.status !== 'CANCELLED' as any && inv.status !== 'VOID' as any);
      
      // Sort by period descending to confidently get the latest invoice
      roomInvoices.sort((a, b) => b.period.localeCompare(a.period));
      
      const lastInvoice = roomInvoices.length > 0
        ? roomInvoices[0]
        : null;

      return {
        ...room,
        prevMeter: lastInvoice ? (parseFloat(lastInvoice.currMeter as any ?? (lastInvoice as any).curr_meter ?? 0) || 0) : 0,
        lastStatus: lastInvoice?.status ?? null,
      };
    });

    return NextResponse.json({ success: true, rooms: enriched });
  } catch (error) {
    console.error('[GET /api/rooms]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms.' },
      { status: 502 }
    );
  }
}
