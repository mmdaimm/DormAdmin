import { NextResponse } from 'next/server';
import { getRooms, getAllInvoices, getTenants } from '@/services/sheetService';
import type { Invoice, Room, Tenant } from '@/types';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface DashboardKpi {
  totalRooms: number;
  occupiedRooms: number;   // rooms that have at least one ACTIVE tenant
  unpaidCount: number;     // invoices with status UNPAID or PARTIALLY_PAID
  totalOutstanding: number; // sum of remaining balance across all open invoices
}

export interface EnrichedInvoice extends Invoice {
  roomNumber: string;
  tenantName: string;  // 'ว่าง' if no active tenant found for this room
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────────

/**
 * Aggregates all dashboard data in exactly 3 concurrent Sheets API calls:
 *   Call 1 → getRooms()       Rooms sheet
 *   Call 2 → getAllInvoices()  Invoices sheet
 *   Call 3 → getTenants()      Tenants sheet
 *
 * All KPIs and enrichment are computed entirely in RAM.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [rooms, allInvoices, tenants] = await Promise.all([
      getRooms(),
      getAllInvoices(),
      getTenants(),
    ]);

    // ── Build lookup maps ────────────────────────────────────────────────────
    const roomById = new Map<string, Room>(rooms.map((r) => [r.roomId, r]));

    // Map roomId → active tenant (most recently added wins if multiple)
    const activeTenantByRoom = new Map<string, Tenant>();
    for (const t of tenants) {
      if (t.status === 'ACTIVE') {
        activeTenantByRoom.set(t.room_id, t);
      }
    }

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const occupiedRooms = rooms.filter((r) =>
      activeTenantByRoom.has(r.roomId)
    ).length;

    const openInvoices = allInvoices.filter(
      (inv) => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID'
    );
    const unpaidCount = openInvoices.length;
    const totalOutstanding = openInvoices.reduce(
      (sum, inv) => sum + Math.max(0, inv.totalAmount - inv.paidAmount),
      0
    );

    const kpi: DashboardKpi = {
      totalRooms: rooms.length,
      occupiedRooms,
      unpaidCount,
      totalOutstanding,
    };

    // ── Enriched invoice list (newest period first) ───────────────────────────
    const enrichedInvoices: EnrichedInvoice[] = allInvoices
      .slice()
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((inv) => {
        const room = roomById.get(inv.roomId);
        const tenant = activeTenantByRoom.get(inv.roomId);
        const tenantName = tenant
          ? `${tenant.firstname} ${tenant.lastname}`.trim()
          : 'ว่าง';
        return {
          ...inv,
          roomNumber: room?.roomNumber ?? inv.roomId,
          tenantName,
        };
      });

    return NextResponse.json({ success: true, kpi, invoices: enrichedInvoices });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถโหลดข้อมูล Dashboard ได้' },
      { status: 502 }
    );
  }
}
