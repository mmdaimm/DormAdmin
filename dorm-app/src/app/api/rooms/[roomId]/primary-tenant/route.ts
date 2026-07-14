import { NextRequest, NextResponse } from 'next/server';
import { getTenants, setPrimaryTenant } from '@/services/sheetService';
import { getActiveTenantsForRoom } from '@/lib/tenantUtils';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<NextResponse> {
  try {
    const { roomId } = await params;
    if (!roomId) {
      return NextResponse.json({ success: false, error: 'Missing roomId' }, { status: 400 });
    }

    const body = await request.json();
    const { tenantId } = body;

    // tenantId is optional — sending it as undefined/null clears the override,
    // falling back to the default (earliest entryDate) behavior.
    if (tenantId !== undefined && tenantId !== null && typeof tenantId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid tenantId' }, { status: 400 });
    }

    if (tenantId) {
      const tenants = await getTenants();
      const activeInRoom = getActiveTenantsForRoom(tenants, roomId);
      const isValidTarget = activeInRoom.some((t) => t.tenantId === tenantId);
      if (!isValidTarget) {
        return NextResponse.json(
          { success: false, error: 'ผู้เช่าที่ระบุไม่ได้เป็นผู้เช่าที่ยัง ACTIVE อยู่ในห้องนี้' },
          { status: 400 }
        );
      }
    }

    await setPrimaryTenant(roomId, tenantId || undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/rooms/[roomId]/primary-tenant]', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถตั้งค่าผู้ติดต่อหลักได้' },
      { status: 502 }
    );
  }
}
