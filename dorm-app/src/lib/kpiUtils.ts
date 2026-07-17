import type { Room, Tenant, Invoice } from '@/types';

export interface OccupancyResult {
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number; // 0.0 - 1.0
}

/**
 * Bulk-computes occupancy in O(rooms + tenants) time.
 *
 * IMPORTANT: do NOT rewrite this to call getActiveTenantsForRoom() in a
 * loop over rooms — that reintroduces the O(rooms × tenants) performance
 * regression that was previously identified and reverted elsewhere in this
 * project (dashboard/route.ts, tenants/page.tsx). This function reduces
 * tenants to latest-state-by-tenantId ONCE, then does a single pass.
 */
export function calculateOccupancy(rooms: Room[], tenants: Tenant[]): OccupancyResult {
  const latestByTenantId = new Map<string, Tenant>();
  for (const t of tenants) {
    latestByTenantId.set(t.tenantId, t);
  }

  const occupiedRoomIds = new Set<string>();
  for (const t of latestByTenantId.values()) {
    if (t.status === 'ACTIVE') {
      occupiedRoomIds.add(t.room_id);
    }
  }

  const occupiedRooms = rooms.filter((r) => occupiedRoomIds.has(r.roomId)).length;

  return {
    totalRooms: rooms.length,
    occupiedRooms,
    occupancyRate: rooms.length > 0 ? occupiedRooms / rooms.length : 0,
  };
}

export interface IncomeTrendPoint {
  period: string; // YYYY-MM
  income: number;
}

/**
 * Income by billing period (Accrual Basis) — sums paidAmount grouped by
 * invoice.period, NOT by the date payment was actually received (this
 * system doesn't store a payment timestamp). Covers the last `monthsBack`
 * months including the current month.
 */
export function calculateIncomeTrend(invoices: Invoice[], monthsBack: number = 3): IncomeTrendPoint[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return periods.map((period) => {
    const income = invoices
      .filter((inv) => inv.period === period)
      .reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0);
    return { period, income };
  });
}
