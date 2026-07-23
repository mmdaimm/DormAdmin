import type { Tenant, Room, Invoice } from '@/types';
import {
  getSheetValues,
  appendSheetValues,
  updateSheetValues,
} from '@/lib/io';
import {
  getRooms,
  setPrimaryTenant,
  updateRoomRentAndDeposit,
  logAuditAction,
  getRates,
  getLastInvoiceByRoom,
  calculateArrears,
  saveInvoice,
} from '@/services/sheetService';
import { getActiveTenantsForRoom } from '@/lib/tenantUtils';
import {
  calculateMoveOutSettlement,
  SettlementInput,
  SettlementResult,
} from '@/services/settlementCalculator';

const SHEET_TENANTS = 'Tenants';
const SHEET_ROOMS = 'Rooms';

function rowToTenant(row: unknown[]): Tenant {
  return {
    tenantId: String(row[0] ?? '').trim(),
    firstname: String(row[1] ?? '').trim(),
    lastname: String(row[2] ?? '').trim(),
    phone: String(row[3] ?? '').trim(),
    room_id: String(row[4] ?? '').trim(),
    entryDate: String(row[5] ?? '').trim(),
    status: (row[6] as string | undefined)?.trim() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    lineUserId: row[7] ? String(row[7]).trim() : undefined,
  };
}

/**
 * Fetches all tenant rows from the Tenants sheet.
 */
export async function getTenants(): Promise<Tenant[]> {
  const rows = await getSheetValues(`${SHEET_TENANTS}!A2:H`);
  return rows.filter((row) => row[0]).map(rowToTenant);
}

/**
 * Saves or updates a tenant record in the Tenants sheet.
 */
export async function saveTenant(tenant: Tenant): Promise<void> {
  const row = [
    tenant.tenantId,
    tenant.firstname,
    tenant.lastname,
    tenant.phone,
    tenant.room_id,
    tenant.entryDate,
    tenant.status,
    tenant.lineUserId ?? '',
  ];
  await appendSheetValues(`${SHEET_TENANTS}!A1`, [row]);
}

export interface MoveInParams {
  firstname: string;
  lastname: string;
  phone: string;
  room_id: string;
  entryDate: string;
  lineUserId?: string;
  depositAmount?: number;
  monthlyRent?: number;
  initialElectricMeter?: number;
}

/**
 * Executes a Move-In workflow for a new tenant into a room.
 */
export async function moveInTenant(
  params: MoveInParams,
  performedBy = 'system'
): Promise<{ tenant: Tenant; room: Room }> {
  const { firstname, lastname, phone, room_id, entryDate, lineUserId, depositAmount, monthlyRent } = params;

  // 1. Verify Room exists
  const rooms = await getRooms();
  const room = rooms.find((r) => r.roomId === room_id.trim());
  if (!room) {
    throw new Error(`ไม่พบห้องพักรหัส "${room_id}" ในระบบ`);
  }

  // 2. Verify Room Availability
  const allTenants = await getTenants();
  const activeTenants = getActiveTenantsForRoom(allTenants, room_id.trim());
  if (activeTenants.length > 0) {
    throw new Error(`ห้อง ${room.roomNumber} มีผู้เช่าอยู่แล้ว (${activeTenants[0].firstname} ${activeTenants[0].lastname})`);
  }

  // 3. Create Tenant Record
  const tenantId = `T-${Date.now()}`;
  const tenant: Tenant = {
    tenantId,
    firstname: firstname.trim(),
    lastname: lastname.trim(),
    phone: phone.trim(),
    room_id: room_id.trim(),
    entryDate: entryDate.trim(),
    status: 'ACTIVE',
    lineUserId: lineUserId?.trim() || undefined,
  };

  await saveTenant(tenant);

  // 4. Update Room Primary Tenant and optional Rent/Deposit
  await setPrimaryTenant(room_id.trim(), tenantId);

  const updatedRent = monthlyRent !== undefined && monthlyRent >= 0 ? monthlyRent : room.monthlyRent;
  const updatedDeposit = depositAmount !== undefined && depositAmount >= 0 ? depositAmount : (room.depositAmount ?? 0);

  if (updatedRent !== room.monthlyRent || updatedDeposit !== (room.depositAmount ?? 0)) {
    await updateRoomRentAndDeposit(room_id.trim(), updatedRent, updatedDeposit);
  }

  // 5. Audit Log
  await logAuditAction(
    'MOVE_IN',
    `ย้ายเข้าผู้เช่า ${tenant.firstname} ${tenant.lastname} เข้าห้อง ${room.roomNumber} (มัดจำ: ${updatedDeposit} บาท)`,
    performedBy
  );

  const updatedRoom: Room = {
    ...room,
    monthlyRent: updatedRent,
    depositAmount: updatedDeposit,
    primaryTenantId: tenantId,
  };

  return { tenant, room: updatedRoom };
}

export interface MoveOutParams {
  roomId: string;
  moveOutDate: string;
  finalElectricMeter: number;
  damageFee?: number;
  damageNotes?: string;
  isFullMonthRent?: boolean;
  pdfUrl?: string;
  overrideForfeit?: boolean;
}

/**
 * Previews the Move-Out settlement calculations without mutating state.
 */
export async function previewMoveOutSettlement(params: MoveOutParams): Promise<SettlementResult> {
  const { roomId, moveOutDate, finalElectricMeter, damageFee = 0, damageNotes = '', isFullMonthRent = false, overrideForfeit = false } = params;

  const [rooms, rates, lastInvoice, allTenants] = await Promise.all([
    getRooms(),
    getRates(),
    getLastInvoiceByRoom(roomId),
    getTenants(),
  ]);

  const room = rooms.find((r) => r.roomId === roomId);
  if (!room) throw new Error(`ไม่พบห้องพักรหัส "${roomId}" ในระบบ`);

  const activeTenants = getActiveTenantsForRoom(allTenants, roomId);
  if (activeTenants.length === 0) {
    throw new Error(`ห้อง ${room.roomNumber} ไม่มีผู้เช่าอยู่ปัจจุบัน`);
  }

  const primaryTenant = activeTenants.find((t) => t.tenantId === room.primaryTenantId) || activeTenants[0];

  const prevElectricMeter = lastInvoice ? lastInvoice.currMeter : 0;
  const arrears = calculateArrears(lastInvoice);
  const minStayMonths = room.minStayMonths !== undefined ? room.minStayMonths : (rates.minStayMonths ?? 5);

  return calculateMoveOutSettlement({
    roomId: room.roomId,
    roomNumber: room.roomNumber,
    moveOutDate,
    entryDate: primaryTenant?.entryDate,
    finalElectricMeter,
    prevElectricMeter,
    monthlyRent: room.monthlyRent,
    depositAmount: room.depositAmount ?? 0,
    creditBalance: room.creditBalance ?? 0,
    arrears,
    electricRate: rates.electricRate,
    waterRate: rates.waterRate,
    damageFee,
    damageNotes,
    isFullMonthRent,
    minStayMonths,
    overrideForfeit,
  });
}

/**
 * Executes the Move-Out workflow:
 * 1. Calculates final settlement
 * 2. Creates final settlement invoice in SHEET_INVOICES
 * 3. Deactivates all active tenants for the room (status: INACTIVE)
 * 4. Clears room primaryTenantId and resets creditBalance to 0
 * 5. Logs audit action
 */
export async function moveOutTenant(
  params: MoveOutParams,
  performedBy = 'system'
): Promise<{ settlement: SettlementResult; invoice: Invoice }> {
  const settlement = await previewMoveOutSettlement(params);
  const { roomId, roomNumber, moveOutDate, period, finalElectricMeter, prevElectricMeter, waterBill, damageFee, arrears, totalCharges, additionalPayAmount } = settlement;

  const allTenants = await getTenants();
  const activeTenants = getActiveTenantsForRoom(allTenants, roomId);

  // 1. Create Settlement Invoice Record (totalAmount = current month charges ONLY, excluding arrears)
  const currentMonthCharges = settlement.proratedRent + settlement.electricityBill + settlement.waterBill + settlement.damageFee;
  const invoiceId = `INV-${roomId}-${period}`;
  const invoice: Invoice = {
    invoiceId,
    roomId,
    period,
    prevMeter: prevElectricMeter,
    currMeter: finalElectricMeter,
    waterBill,
    otherBill: damageFee,
    arrears,
    totalAmount: currentMonthCharges,
    paidAmount: additionalPayAmount === 0 ? settlement.totalCharges : 0,
    status: additionalPayAmount === 0 ? 'PAID' : 'UNPAID',
    pdfUrl: params.pdfUrl,
    remainingArrears: arrears,
    creditApplied: settlement.creditBalance,
    proratedAmount: settlement.monthlyRent - settlement.proratedRent,
    isNewFormat: true,
  };

  await saveInvoice(invoice);

  // 2. Deactivate Active Tenants
  for (const tenant of activeTenants) {
    const inactiveTenant: Tenant = {
      ...tenant,
      status: 'INACTIVE',
    };
    await saveTenant(inactiveTenant);
  }

  // 3. Clear Room Primary Tenant & Reset Credit Balance to 0
  await setPrimaryTenant(roomId, undefined);

  // Reset room creditBalance to 0 in sheet
  const roomRows = await getSheetValues(`${SHEET_ROOMS}!A2:F`);
  const roomRowIndex = roomRows.findIndex((r) => String(r[0] ?? '').trim() === roomId);
  if (roomRowIndex !== -1) {
    const sheetRow = roomRowIndex + 2;
    await updateSheetValues(`${SHEET_ROOMS}!E${sheetRow}`, [[0]]);
  }

  // 4. Audit Log
  const netDesc = settlement.refundAmount > 0 
    ? `คืนเงินมัดจำสุทธิ: ${settlement.refundAmount} บาท` 
    : `ผู้เช่าต้องชำระเพิ่ม: ${settlement.additionalPayAmount} บาท`;

  await logAuditAction(
    'MOVE_OUT',
    `ย้ายออกผู้เช่าห้อง ${roomNumber} ณ วันที่ ${moveOutDate} (${netDesc})`,
    performedBy
  );

  return { settlement, invoice };
}
