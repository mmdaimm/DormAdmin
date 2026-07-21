import { NextRequest, NextResponse } from 'next/server';
import { moveInTenant, MoveInParams } from '@/services/tenantService';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { decrypt } from '@/lib/auth';

const PHONE_RE = /^\d{10}$/;

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * POST /api/tenants/move-in
 * Registers a new tenant move-in workflow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: MoveInParams;
  try {
    body = (await request.json()) as MoveInParams;
  } catch {
    return apiError('ข้อมูล JSON ไม่ถูกต้อง', 400);
  }

  const { firstname, lastname, phone, room_id, entryDate } = body;

  const fieldErrors: Record<string, string> = {};

  if (!firstname?.trim()) fieldErrors.firstname = 'กรุณาระบุชื่อ';
  if (!lastname?.trim()) fieldErrors.lastname = 'กรุณาระบุนามสกุล';
  if (!PHONE_RE.test(phone?.trim() ?? '')) fieldErrors.phone = 'เบอร์โทรศัพท์ต้องมี 10 หลัก';
  if (!isValidDate(entryDate?.trim() ?? '')) fieldErrors.entryDate = 'วันที่ย้ายเข้าต้องอยู่ในรูปแบบ YYYY-MM-DD';
  if (!room_id?.trim()) fieldErrors.room_id = 'กรุณาระบุหมายเลขห้องพัก';

  if (Object.keys(fieldErrors).length > 0) {
    return apiError('ข้อมูลไม่ถูกต้อง', 400, fieldErrors);
  }

  // Get current user session for audit log
  const token = request.cookies.get('auth_token')?.value;
  const session = await decrypt(token);
  const username = session?.username ?? 'system';

  try {
    const result = await moveInTenant(body, username);
    return apiSuccess(
      {
        message: `ย้ายเข้าห้อง ${result.room.roomNumber} เรียบร้อยแล้ว`,
        tenant: result.tenant,
        room: result.room,
      },
      201
    );
  } catch (error: any) {
    console.error('[POST /api/tenants/move-in]', error);
    return apiError(error.message || 'ไม่สามารถดำเนินการย้ายเข้าได้', 400);
  }
}
