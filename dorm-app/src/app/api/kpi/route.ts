import { NextResponse } from 'next/server';
import { getRooms, getTenants, getAllInvoices } from '@/services/sheetService';
import { calculateOccupancy, calculateIncomeTrend } from '@/lib/kpiUtils';

export async function GET(): Promise<NextResponse> {
  try {
    const [rooms, tenants, invoices] = await Promise.all([
      getRooms(),
      getTenants(),
      getAllInvoices(),
    ]);

    const occupancy = calculateOccupancy(rooms, tenants);
    const incomeTrend = calculateIncomeTrend(invoices, 3);

    return NextResponse.json({ success: true, occupancy, incomeTrend });
  } catch (error) {
    console.error('[GET /api/kpi]', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดข้อมูล KPI ได้' },
      { status: 502 }
    );
  }
}
