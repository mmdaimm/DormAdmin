import { NextRequest, NextResponse } from 'next/server';
import { getTenants, getRooms, saveTenant } from '@/services/sheetService';
import type { Tenant } from '@/types';

// ─── POST body shape ──────────────────────────────────────────────────────────

interface CreateTenantBody {
  firstname: string;
  lastname: string;
  phone: string;
  room_id: string;
  status?: 'ACTIVE' | 'INACTIVE';
  lineUserId?: string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Phone must be exactly 10 Thai digits (0-9, no spaces/dashes). */
const PHONE_RE = /^\d{10}$/;

/** entryDate must be YYYY-MM-DD and parse to a valid calendar date. */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// ─── GET /api/tenants ─────────────────────────────────────────────────────────

/**
 * Returns the full list of tenant records from the Tenants sheet.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const tenants = await getTenants();
    return NextResponse.json({ success: true, tenants });
  } catch (error) {
    console.error('[GET /api/tenants]', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดข้อมูลผู้เช่าได้' },
      { status: 502 }
    );
  }
}

// ─── POST /api/tenants ────────────────────────────────────────────────────────

/**
 * Creates a new tenant record in the Tenants sheet.
 *
 * Strict server-side validation (mirrors client-side to prevent bad saves):
 *   • firstname, lastname  — required, non-empty
 *   • phone                — exactly 10 digits
 *   • entryDate            — valid YYYY-MM-DD
 *   • room_id              — must exist in the Rooms sheet
 *
 * The tenantId is generated server-side as `T-{timestamp}` to avoid
 * collisions without requiring a sequence lock on the sheet.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body ─────────────────────────────────────────────────────────────
  let body: CreateTenantBody;
  try {
    body = (await request.json()) as CreateTenantBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'ข้อมูล JSON ไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  const { firstname, lastname, phone, room_id, entryDate, status = 'ACTIVE', lineUserId } = body;

  // 2. Validate required string fields ────────────────────────────────────────
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
    return NextResponse.json(
      { success: false, error: 'ข้อมูลไม่ถูกต้อง', fieldErrors },
      { status: 400 }
    );
  }

  // 3. Verify room_id exists in the Rooms sheet ───────────────────────────────
  let rooms: Awaited<ReturnType<typeof getRooms>>;
  try {
    rooms = await getRooms();
  } catch (error) {
    console.error('[POST /api/tenants] Failed to fetch rooms:', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถตรวจสอบข้อมูลห้องได้' },
      { status: 502 }
    );
  }

  const roomExists = rooms.some((r) => r.roomId === room_id.trim());
  if (!roomExists) {
    return NextResponse.json(
      {
        success: false,
        error: `ไม่พบห้อง "${room_id}" ในระบบ`,
        fieldErrors: { room_id: `ไม่พบห้อง "${room_id}" ในระบบ` },
      },
      { status: 400 }
    );
  }

  // 4. Build and persist the tenant record ────────────────────────────────────
  const tenant: Tenant = {
    tenantId:  `T-${Date.now()}`,
    firstname: firstname.trim(),
    lastname:  lastname.trim(),
    phone:     phone.trim(),
    room_id:   room_id.trim(),
    entryDate: entryDate.trim(),
    status,
    lineUserId: lineUserId?.trim(),
  };

  try {
    await saveTenant(tenant);
  } catch (error) {
    console.error('[POST /api/tenants] Failed to save tenant:', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถบันทึกข้อมูลผู้เช่าได้' },
      { status: 502 }
    );
  }

  // 5. Return the created record ───────────────────────────────────────────────
  return NextResponse.json(
    { success: true, message: 'บันทึกข้อมูลผู้เช่าเรียบร้อยแล้ว', tenant },
    { status: 201 }
  );
}
