import { NextRequest, NextResponse } from 'next/server';
import { messagingApi } from '@line/bot-sdk';
import { getTenants, getRooms, getAllInvoices } from '@/services/sheetService';

function getLineClient() {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId } = body;

    // STRICT SECURITY CONSTRAINT: Do NOT accept lineUserId from the client body
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'Missing invoiceId' }, { status: 400 });
    }

    // 1. Fetch invoice
    const allInvoices = await getAllInvoices();
    const invoice = allInvoices.find((inv) => inv.invoiceId === invoiceId);

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    // 2. Identify target Room/Tenant and resolve LINE User ID server-side
    const [tenants, rooms] = await Promise.all([getTenants(), getRooms()]);
    const tenant = tenants.find((t) => t.room_id === invoice.roomId && t.status === 'ACTIVE');
    const room = rooms.find((r) => r.roomId === invoice.roomId);

    if (!tenant?.lineUserId) {
      return NextResponse.json(
        { success: false, error: 'ผู้เช่าห้องนี้ยังไม่ได้เชื่อมต่อ LINE (ไม่มี LINE User ID)' },
        { status: 400 }
      );
    }

    // 3. Trigger Push
    const roomNumber = room?.roomNumber ?? invoice.roomId;

    const baseTotal = parseFloat(invoice.totalAmount as any ?? (invoice as any).total_amount ?? 0) || 0;
    const oldArrears = parseFloat(invoice.remainingArrears as any ?? (invoice as any).old_arrears ?? (invoice as any).oldArrears ?? 0) || 0;
    const credit = parseFloat(invoice.creditApplied as any ?? (invoice as any).credit_applied ?? 0) || 0;
    const grandTotal = baseTotal + oldArrears - credit;

    const formattedTotalAmount = grandTotal.toLocaleString('th-TH');
    const pdfUrlSection = invoice.pdfUrl 
      ? `\n\n📄 สามารถดูและดาวน์โหลดใบแจ้งหนี้ได้ที่ลิงก์นี้ครับ:\n${invoice.pdfUrl}`
      : '';

    const lineMessage =
      `📢 แจ้งเตือนจากหอพักดำรงรักษ์\n\n` +
      `บิลค่าเช่าห้อง ${roomNumber} ประจำเดือน ${invoice.period} ออกแล้วครับ\n` +
      `ยอดชำระ: ${formattedTotalAmount} บาท${pdfUrlSection}`;

    await getLineClient().pushMessage({
      to: tenant.lineUserId,
      messages: [{ type: 'text', text: lineMessage }],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/send-line] LINE Push Error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการส่ง LINE' },
      { status: 502 }
    );
  }
}
