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
      // Filter all invoices for this room, then grab the last one (most recent).
      // getAllInvoices() preserves sheet row order (top-to-bottom), so the last
      // element in the filtered array is the newest entry — consistent with
      // the reverse-scan logic previously used in getLastInvoiceByRoom().
      const roomInvoices = allInvoices.filter((inv) => inv.roomId === room.roomId);
      const lastInvoice = roomInvoices.length > 0
        ? roomInvoices[roomInvoices.length - 1]
        : null;

      return {
        ...room,
        prevMeter: lastInvoice?.currMeter ?? 0,
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
