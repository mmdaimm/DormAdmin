import { NextResponse } from 'next/server';
import { getRooms, getAllInvoices, getTenants } from '@/services/sheetService';
import { getActiveTenantsForRoom } from '@/lib/tenantUtils';
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

    // Get every ACTIVE tenant for each room (N-1 aware) — build a lookup
    // map from roomId to the array of current tenants for that room.
    const activeTenantsByRoom = new Map<string, Tenant[]>();
    for (const room of rooms) {
      const active = getActiveTenantsForRoom(tenants, room.roomId);
      if (active.length > 0) {
        activeTenantsByRoom.set(room.roomId, active);
      }
    }

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const occupiedRooms = rooms.filter((r) =>
      activeTenantsByRoom.has(r.roomId)
    ).length;

    const openInvoices = allInvoices.filter(
      (inv) => inv.status === 'UNPAID' || inv.status === 'PARTIAL'
    );
    const unpaidCount = openInvoices.length;
    const latestInvoicesMap = new Map<string, Invoice>();
    for (const inv of allInvoices) {
      const roomId = inv.roomId ?? (inv as any).room_id;
      const existing = latestInvoicesMap.get(roomId);
      if (!existing || inv.period > existing.period) {
        latestInvoicesMap.set(roomId, inv);
      }
    }
    const latestInvoices = Array.from(latestInvoicesMap.values());

    let totalOutstanding = 0;
    latestInvoices.forEach(inv => {
      const baseTotal = parseFloat(inv.totalAmount as any ?? (inv as any).total_amount ?? 0) || 0;
      const oldArrears = parseFloat(inv.remainingArrears as any ?? (inv as any).old_arrears ?? (inv as any).oldArrears ?? 0) || 0;
      const credit = parseFloat(inv.creditApplied as any ?? (inv as any).credit_applied ?? 0) || 0;
      const paid = parseFloat(inv.paidAmount as any ?? (inv as any).paid_amount ?? 0) || 0;
      
      const grandTotal = baseTotal + oldArrears - credit;
      const remaining = Math.max(0, grandTotal - paid);
      
      totalOutstanding += remaining;
    });

    const kpi: DashboardKpi = {
      totalRooms: rooms.length,
      occupiedRooms,
      unpaidCount,
      totalOutstanding,
    };

    // (Grouping is already done above for totalOutstanding, so we just use latestInvoices)
    const latestInvoicesForEnrichment = latestInvoices;

    const enrichedInvoices: EnrichedInvoice[] = latestInvoicesForEnrichment
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((inv) => {
        const room = roomById.get(inv.roomId);
        const activeTenants = activeTenantsByRoom.get(inv.roomId) ?? [];
        const tenantName = activeTenants.length > 0
          ? activeTenants.map((t) => `${t.firstname} ${t.lastname}`.trim()).join(', ')
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
