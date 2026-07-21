import { NextRequest, NextResponse } from 'next/server';
import { moveOutTenant, previewMoveOutSettlement, MoveOutParams } from '@/services/tenantService';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { decrypt } from '@/lib/auth';

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

interface MoveOutRequestBody extends MoveOutParams {
  isPreview?: boolean;
}

/**
 * POST /api/tenants/move-out
 * Previews settlement or executes move-out workflow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: MoveOutRequestBody;
  try {
    body = (await request.json()) as MoveOutRequestBody;
  } catch {
    return apiError('ข้อมูล JSON ไม่ถูกต้อง', 400);
  }

  const { roomId, moveOutDate, finalElectricMeter, isPreview = false } = body;

  const fieldErrors: Record<string, string> = {};
  if (!roomId?.trim()) fieldErrors.roomId = 'กรุณาระบุรหัสห้องพัก';
  if (!isValidDate(moveOutDate?.trim() ?? '')) fieldErrors.moveOutDate = 'วันที่ย้ายออกต้องอยู่ในรูปแบบ YYYY-MM-DD';
  if (finalElectricMeter === undefined || finalElectricMeter < 0) {
    fieldErrors.finalElectricMeter = 'กรุณาระบุเลขมิเตอร์ไฟสุดท้ายให้ถูกต้อง';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return apiError('ข้อมูลไม่ถูกต้อง', 400, fieldErrors);
  }

  // 1. Preview Mode
  if (isPreview) {
    try {
      const settlement = await previewMoveOutSettlement(body);
      return apiSuccess({ settlement });
    } catch (error: any) {
      console.error('[POST /api/tenants/move-out preview]', error);
      return apiError(error.message || 'ไม่สามารถคำนวณการปิดบัญชีย้ายออกได้', 400);
    }
  }

  // 2. Execute Move-out Mode
  const token = request.cookies.get('auth_token')?.value;
  const session = await decrypt(token);
  const username = session?.username ?? 'system';

  try {
    const result = await moveOutTenant(body, username);
    return apiSuccess(
      {
        message: `บันทึกการย้ายออกห้อง ${result.settlement.roomNumber} เรียบร้อยแล้ว`,
        settlement: result.settlement,
        invoice: result.invoice,
      },
      200
    );
  } catch (error: any) {
    console.error('[POST /api/tenants/move-out execute]', error);
    return apiError(error.message || 'ไม่สามารถบันทึกการย้ายออกได้', 400);
  }
}
