import type { Tenant } from '@/types';

/**
 * Reduces a tenant list to the single active tenant for a room, following
 * the "Last Write Wins" rule required by this project's Append-Only
 * Tenants sheet architecture (see ADR in project docs).
 *
 * Always takes the array's LAST matching record for the room (the most
 * recently appended row) before checking status — never the first ACTIVE
 * match via .find(), which would incorrectly return a stale record if the
 * tenant later moved out and a newer INACTIVE row was appended after it.
 *
 * Returns null if the room has no tenant history, or if the latest record
 * for the room is not ACTIVE (i.e. the room is currently vacant).
 */
export function getActiveTenantForRoom(tenants: Tenant[], roomId: string): Tenant | null {
  const roomTenants = tenants.filter((t) => t.room_id === roomId);
  const latestTenant = roomTenants[roomTenants.length - 1] ?? null;
  return latestTenant && latestTenant.status === 'ACTIVE' ? latestTenant : null;
}
