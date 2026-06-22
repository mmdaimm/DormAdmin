import { NextResponse } from 'next/server';
import { getRooms, getLastInvoiceByRoom } from '@/services/sheetService';

/**
 * GET /api/rooms
 *
 * Returns every room together with its most recent prevMeter reading
 * (the currMeter of its last invoice) so the frontend can pre-fill the field.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rooms = await getRooms();

    // Fetch last invoice for each room in parallel to get prevMeter
    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const lastInvoice = await getLastInvoiceByRoom(room.roomId);
        return {
          ...room,
          prevMeter: lastInvoice?.currMeter ?? 0,
          lastStatus: lastInvoice?.status ?? null,
        };
      })
    );

    return NextResponse.json({ success: true, rooms: enriched });
  } catch (error) {
    console.error('[GET /api/rooms]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms.' },
      { status: 502 }
    );
  }
}
