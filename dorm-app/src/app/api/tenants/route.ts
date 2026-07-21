import { NextRequest, NextResponse } from 'next/server';
import { getTenants, saveTenant } from '@/services/tenantService';
import { getRooms } from '@/services/sheetService';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import type { Tenant } from '@/types';

// ─── POST body shape ──────────────────────────────────────────────────────────

interface CreateTenantBody {
  firstname: string;
  lastname: string;
  phone: string;
  room_id: string;
  entryDate: string;
  status?: 'ACTIVE' | 'INACTIVE';
  tenantId?: string;
  lineUserId?: string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const PHONE_RE = /^\d{10}$/;

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// ─── GET /api/tenants ─────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const tenants = await getTenants();
    return apiSuccess({ tenants });
  } catch (error) {
    console.error('[GET /api/tenants]', error);
    return apiError('ไม่สามารถโหลดข้อมูลผู้เช่าได้', 502);
  }
}

// ─── POST /api/tenants ────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CreateTenantBody;
  try {
    body = (await request.json()) as CreateTenantBody;
  } catch {
    return apiError('ข้อมูล JSON ไม่ถูกต้อง', 400);
  }

  const { firstname, lastname, phone, room_id, entryDate, status = 'ACTIVE', tenantId, lineUserId } = body;

  const fieldErrors: Record<string, string> = {};

  if (!firstname?.trim()) {
    fieldErrors.firstname = 'กรุณาระบุชื่อ';
  }
  if (!lastname?.trim()) {
    fieldErrors.lastname = 'กรุณาระบุนามสกุล';
  }
  if (!PHONE_RE.test(phone?.trim() ?? '')) {
    fieldErrors.phone = 'เบอร์โทรศัพท์ต้องมี 10 หลัก';
  }
  if (!isValidDate(entryDate?.trim() ?? '')) {
    fieldErrors.entryDate = 'วันที่ย้ายเข้าต้องอยู่ในรูปแบบ YYYY-MM-DD';
  }
  if (!room_id?.trim()) {
    fieldErrors.room_id = 'กรุณาระบุหมายเลขห้อง';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return apiError('ข้อมูลไม่ถูกต้อง', 400, fieldErrors);
  }

  let rooms: Awaited<ReturnType<typeof getRooms>>;
  try {
    rooms = await getRooms();
  } catch (error) {
    console.error('[POST /api/tenants] Failed to fetch rooms:', error);
    return apiError('ไม่สามารถตรวจสอบข้อมูลห้องได้', 502);
  }

  const roomExists = rooms.some((r) => r.roomId === room_id.trim());
  if (!roomExists) {
    return apiError(`ไม่พบห้อง "${room_id}" ในระบบ`, 400, { room_id: `ไม่พบห้อง "${room_id}" ในระบบ` });
  }

  const tenant: Tenant = {
    tenantId: tenantId?.trim() || `T-${Date.now()}`,
    firstname: firstname.trim(),
    lastname: lastname.trim(),
    phone: phone.trim(),
    room_id: room_id.trim(),
    entryDate: entryDate.trim(),
    status,
    lineUserId: lineUserId?.trim() || undefined,
  };

  try {
    await saveTenant(tenant);
  } catch (error) {
    console.error('[POST /api/tenants] Failed to save tenant:', error);
    return apiError('ไม่สามารถบันทึกข้อมูลผู้เช่าได้', 502);
  }

  return apiSuccess(
    { message: 'บันทึกข้อมูลผู้เช่าเรียบร้อยแล้ว', tenant },
    201
  );
}
