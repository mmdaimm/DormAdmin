import type { Tenant } from '@/types';

/**
 * Reduces a tenant list to each tenant's latest state, keyed by tenantId
 * (not room_id). This is the N-1-aware version of "Last Write Wins" — it
 * tracks each PERSON's latest record independently, so editing one
 * co-tenant's info doesn't affect another co-tenant's record in the same
 * room.
 *
 * Requires tenantId to be stable across edits for the same person (the
 * backend must reuse the same tenantId when updating an existing tenant,
 * not generate a new one — see /api/tenants POST).
 */
function getLatestStateByTenantId(tenants: Tenant[]): Map<string, Tenant> {
  const map = new Map<string, Tenant>();
  for (const t of tenants) {
    map.set(t.tenantId, t);
  }
  return map;
}

/**
 * Returns every ACTIVE tenant currently living in a room, sorted by
 * entryDate ascending (earliest move-in date first — the "primary"
 * tenant, by convention, is index 0).
 *
 * Returns an empty array if the room is vacant.
 */
export function getActiveTenantsForRoom(tenants: Tenant[], roomId: string): Tenant[] {
  const latest = getLatestStateByTenantId(tenants);
  return Array.from(latest.values())
    .filter((t) => t.room_id === roomId && t.status === 'ACTIVE')
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

/**
 * Returns the single "primary" active tenant for a room — the one with
 * the earliest entryDate among current ACTIVE tenants. For rooms with
 * exactly one tenant (the common case today), this behaves identically
 * to before. For rooms with multiple tenants (N-1), this returns the
 * primary contract-holder, used anywhere the system still expects a
 * single tenant (LINE notifications, invoice-creation eligibility checks).
 *
 * Returns null if the room has no tenant history, or if no tenant record
 * for the room is currently ACTIVE (the room is vacant).
 */
export function getActiveTenantForRoom(
  tenants: Tenant[],
  roomId: string,
  primaryTenantId?: string
): Tenant | null {
  const active = getActiveTenantsForRoom(tenants, roomId);
  if (primaryTenantId) {
    const designated = active.find((t) => t.tenantId === primaryTenantId);
    if (designated) return designated;
  }
  return active[0] ?? null;
}
