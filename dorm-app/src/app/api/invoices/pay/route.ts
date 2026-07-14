import { NextRequest, NextResponse } from 'next/server';
import { messagingApi } from '@line/bot-sdk';
import { processPayment, getTenants, getRooms } from '@/services/sheetService';
import { getActiveTenantForRoom } from '@/lib/tenantUtils';

function getLineClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  });
}

interface PayBody {
  invoiceId: string;
  amountPaid: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: PayBody;
  try {
    body = (await request.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: 'ข้อมูล JSON ไม่ถูกต้อง' }, { status: 400 });
  }

  const { invoiceId, amountPaid } = body;

  if (!invoiceId?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุ invoiceId' }, { status: 400 });
  }

  // STRICT SERVER-SIDE VALIDATION:
  if (amountPaid <= 0) {
    return NextResponse.json({ error: 'ยอดชำระต้องมากกว่า 0 บาท' }, { status: 400 });
  }

  let roomId: string;
  let totalAmount: number;
  let newCredit: number;
  let cumulativePaid: number;
  let newStatus: string;

  try {
    ({ roomId, totalAmount, newCredit, cumulativePaid, newStatus } = await processPayment(invoiceId.trim(), amountPaid));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    if (message.includes('ไม่พบ')) return NextResponse.json({ error: message }, { status: 404 });
    if (message.includes('ชำระแล้ว')) return NextResponse.json({ error: message }, { status: 409 });

    console.error('[POST /api/invoices/pay]', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3. Push LINE receipt notification (fire-and-forget)
  void (async () => {
    try {
      const [tenants, rooms] = await Promise.all([getTenants(), getRooms()]);

      const tenant = getActiveTenantForRoom(
        tenants,
        roomId,
        rooms.find((r) => r.roomId === roomId)?.primaryTenantId
      );
      
      const room = rooms.find((r) => r.roomId === roomId);
      const roomNumber = room?.roomNumber ?? roomId;

      if (tenant?.lineUserId) {
        let lineMessage = `✅ ได้รับชำระเงินค่าห้อง ${roomNumber} จำนวน ${amountPaid.toLocaleString('th-TH')} บาท เรียบร้อยแล้ว\n`;
        
        if (newCredit > 0) {
          lineMessage += `👉 ยอดชำระเกิน ${newCredit.toLocaleString('th-TH')} บาท ระบบได้บันทึกเป็นเครดิตสะสมสำหรับรอบบิลถัดไป\n`;
        } else if (newStatus === 'PARTIAL') {
          const trueRemaining = totalAmount - cumulativePaid;
          lineMessage += `👉 คงค้างชำระ ${trueRemaining.toLocaleString('th-TH')} บาท\n`;
        }

        lineMessage += `ขอบคุณค่ะ 😊`;

        try {
          await getLineClient().pushMessage({
            to: tenant.lineUserId,
            messages: [{ type: 'text', text: lineMessage }],
          });
        } catch (lineError) {
          console.error('[LINE Push Failed - Mark Paid]', { invoiceId, error: lineError });
        }
      }
    } catch (fetchError) {
      console.error('[POST /api/invoices/pay] Failed to fetch data for LINE push:', fetchError);
    }
  })();

  return NextResponse.json({
    success: true,
    message: `บันทึกการรับชำระเงินใบแจ้งหนี้ ${invoiceId} เรียบร้อยแล้ว`,
  });
}
