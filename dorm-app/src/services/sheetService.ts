import { ELECTRIC_RATE_PER_UNIT, WATER_BILL_FIXED } from '@/config/dorm';
import type { Invoice, Room, SettingRate, Tenant } from '@/types';
import { getSheetValues, appendSheetValues, updateSheetValues, batchUpdateSheetValues } from '@/lib/io';

// ─── Sheet name constants ─────────────────────────────────────────────────────

export const SHEET_SETTINGS = 'Settings';
const SHEET_ROOMS = 'Rooms';
const SHEET_INVOICES = 'Invoices';
const SHEET_TENANTS = 'Tenants';
const SHEET_USERS = 'Users';
const SHEET_EXPENSES = 'Expenses';
const SHEET_AUDIT_LOG = 'AuditLog';

// ─── Rates ────────────────────────────────────────────────────────────────────

export interface Rates {
  electricRate: number;
  waterRate: number;
}

export async function getRates(): Promise<Rates> {
  const rates: Rates = {
    electricRate: ELECTRIC_RATE_PER_UNIT,
    waterRate: WATER_BILL_FIXED,
  };

  try {
    const rows = await getSheetValues(`${SHEET_SETTINGS}!A2:C`);

    for (const row of rows) {
      const key = (row[0] as string | undefined)?.trim() as SettingRate['key'];
      const rawValue = row[1] as string | undefined;
      const parsed = rawValue !== undefined ? parseFloat(rawValue) : NaN;

      if (isNaN(parsed)) continue;

      if (key === 'electric_rate') rates.electricRate = parsed;
      else if (key === 'water_rate') rates.waterRate = parsed;
    }
  } catch (error) {
    console.warn('[sheetService.getRates] Failed to fetch settings — using defaults.', error);
  }

  return rates;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function getRooms(): Promise<Room[]> {
  const rows = await getSheetValues(`${SHEET_ROOMS}!A2:G`);

  return rows
    .filter((row) => row[0])
    .map((row): Room => ({
      roomId: String(row[0] ?? '').trim(),
      roomNumber: String(row[1] ?? '').trim(),
      monthlyRent: parseFloat(row[2]) || 0,
      lineToken: String(row[3] ?? '').trim(),
      creditBalance: Math.max(0, parseFloat(row[4] as string) || 0),
      depositAmount: parseFloat(row[5] as string) || 0,
      primaryTenantId: row[6] ? String(row[6]).trim() : undefined,
    }));
}

/**
 * Sets (or clears, if tenantId is undefined) the designated primary contact
 * for a room. Rooms is update-in-place (not append-only like Tenants) —
 * this overwrites Column G directly, mirroring how credit_balance updates
 * work elsewhere in this file.
 */
export async function setPrimaryTenant(roomId: string, tenantId: string | undefined): Promise<void> {
  const rows = await getSheetValues(`${SHEET_ROOMS}!A2:G`);
  const rowIndex = rows.findIndex((r) => String(r[0] ?? '').trim() === roomId);
  if (rowIndex === -1) {
    throw new Error(`Room with roomId "${roomId}" not found.`);
  }
  const sheetRow = rowIndex + 2;
  await updateSheetValues(`${SHEET_ROOMS}!G${sheetRow}`, [[tenantId ?? '']]);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function rowToInvoice(row: unknown[]): Invoice {
  return {
    invoiceId: String(row[0] ?? '').trim(),
    roomId: String(row[1] ?? '').trim(),
    period: String(row[2] ?? '').trim(),
    prevMeter: parseFloat(row[3] as string) || 0,
    currMeter: parseFloat(row[4] as string) || 0,
    waterBill: parseFloat(row[5] as string) || 0,
    otherBill: parseFloat(row[6] as string) || 0,
    arrears: parseFloat(row[7] as string) || 0,
    totalAmount: parseFloat(row[8] as string) || 0,
    paidAmount: parseFloat(row[9] as string) || 0,
    status: (row[10] as Invoice['status']) ?? 'UNPAID',
    pdfUrl: row[11] ? String(row[11]).trim() : undefined,
    remainingArrears: parseFloat(row[12] as string) || 0,
    creditApplied: parseFloat(row[15] as string) || 0,
    isNewFormat: row.length >= 14,
    proratedAmount: row[14] ? parseFloat(row[14] as string) : 0,
  };
}

export async function getLastInvoiceByRoom(roomId: string): Promise<Invoice | null> {
  const rows = await getSheetValues(`${SHEET_INVOICES}!A2:P`);

  const roomInvoices = rows
    .filter((row) => String(row[1] ?? '').trim() === roomId)
    .map(rowToInvoice)
    .sort((a, b) => b.period.localeCompare(a.period));
    
  return roomInvoices.length > 0 ? roomInvoices[0] : null;
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const rows = await getSheetValues(`${SHEET_INVOICES}!A2:P`);
  return rows.filter((row) => row[0]).map(rowToInvoice);
}

export function calculateArrears(lastInvoice: Invoice | null): number {
  if (!lastInvoice) return 0;
  switch (lastInvoice.status) {
    case 'UNPAID': return lastInvoice.totalAmount;
    case 'PARTIAL': return lastInvoice.arrears;
    case 'PAID': default: return 0;
  }
}

export async function saveInvoice(invoiceData: Invoice): Promise<void> {
  const row = [
    invoiceData.invoiceId,
    invoiceData.roomId,
    invoiceData.period,
    invoiceData.prevMeter,
    invoiceData.currMeter,
    invoiceData.waterBill,
    invoiceData.otherBill,
    invoiceData.arrears,
    invoiceData.totalAmount,
    0,
    'UNPAID',
    invoiceData.pdfUrl ?? '',
    invoiceData.arrears,
    '',
    invoiceData.proratedAmount || 0,
    invoiceData.creditApplied ?? 0,
  ];

  await appendSheetValues(`${SHEET_INVOICES}!A1`, [row]);
}

/**
 * Fields that manual override (PUT /api/invoices) is allowed to change.
 * Everything else — especially remainingArrears (old_arrears, immutable
 * after invoice creation) and pdfUrl (must never be blanked out) — is
 * silently ignored even if present in the caller's `updates` object.
 */
const UPDATABLE_INVOICE_FIELDS = ['status', 'paidAmount', 'arrears'] as const;

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Pick<Invoice, typeof UPDATABLE_INVOICE_FIELDS[number]>>
): Promise<{ old: Invoice; updated: Invoice } | null> {
  const rows = await getSheetValues(`${SHEET_INVOICES}!A2:P`);
  const rowIndex = rows.findIndex(row => String(row[0] ?? '').trim() === invoiceId);
  if (rowIndex === -1) return null;

  const existingInvoice = rowToInvoice(rows[rowIndex]);

  const safeUpdates: Partial<Invoice> = {};
  for (const key of UPDATABLE_INVOICE_FIELDS) {
    if (updates[key] !== undefined) {
      (safeUpdates as any)[key] = updates[key];
    }
  }

  const updatedInvoice = { ...existingInvoice, ...safeUpdates };

  const newRow = [
    updatedInvoice.invoiceId,
    updatedInvoice.roomId,
    updatedInvoice.period,
    updatedInvoice.prevMeter,
    updatedInvoice.currMeter,
    updatedInvoice.waterBill,
    updatedInvoice.otherBill,
    updatedInvoice.arrears,
    updatedInvoice.totalAmount,
    updatedInvoice.paidAmount,
    updatedInvoice.status,
    updatedInvoice.pdfUrl ?? '',
    updatedInvoice.remainingArrears ?? 0,
    '',
    updatedInvoice.proratedAmount ?? 0,
    updatedInvoice.creditApplied ?? 0,
  ];

  const sheetRow = rowIndex + 2;
  await updateSheetValues(`${SHEET_INVOICES}!A${sheetRow}:P${sheetRow}`, [newRow]);

  return { old: existingInvoice, updated: updatedInvoice };
}

/**
 * Appends an audit trail entry to the AuditLog sheet. Append-only, matching
 * this project's design philosophy — audit entries are never edited or
 * deleted after the fact. Column layout: A=timestamp (ISO), B=action,
 * C=details, D=performedBy.
 */
export async function logAuditAction(
  action: string,
  details: string,
  performedBy: string
): Promise<void> {
  const row = [new Date().toISOString(), action, details, performedBy];
  await appendSheetValues(`${SHEET_AUDIT_LOG}!A1`, [row]);
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

function rowToTenant(row: unknown[]): Tenant {
  return {
    tenantId:   String(row[0] ?? '').trim(),
    firstname:  String(row[1] ?? '').trim(),
    lastname:   String(row[2] ?? '').trim(),
    phone:      String(row[3] ?? '').trim(),
    room_id:    String(row[4] ?? '').trim(),
    entryDate:  String(row[5] ?? '').trim(),
    status:     ((row[6] as string | undefined)?.trim() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
    lineUserId: row[7] ? String(row[7]).trim() : undefined,
  };
}

export async function getTenants(): Promise<Tenant[]> {
  const rows = await getSheetValues(`${SHEET_TENANTS}!A2:H`);
  return rows.filter((row) => row[0]).map(rowToTenant);
}

export async function processPayment(
  invoiceId: string,
  amountPaid: number
): Promise<{ roomId: string; totalAmount: number; newCredit: number; cumulativePaid: number; newStatus: string }> {
  
  const rows = await getSheetValues(`${SHEET_INVOICES}!A2:P`);
  const rowIndex = rows.findIndex((row) => String(row[0] ?? '').trim() === invoiceId);

  if (rowIndex === -1) throw new Error(`ไม่พบใบแจ้งหนี้รหัส "${invoiceId}" ในระบบ`);

  const currentStatus = String(rows[rowIndex][10] ?? '').trim();
  if (currentStatus === 'PAID') throw new Error(`ใบแจ้งหนี้ "${invoiceId}" ถูกบันทึกว่าชำระแล้ว`);

  const totalAmount    = parseFloat(String(rows[rowIndex][8] ?? '')) || 0;
  const arrearsOnBill  = parseFloat(String(rows[rowIndex][7] ?? '')) || 0;
  const creditApplied  = parseFloat(String(rows[rowIndex][15] ?? '')) || 0;
  const existingPaid   = parseFloat(String(rows[rowIndex][9] ?? '')) || 0;
  const existingUrl    = String(rows[rowIndex][11] ?? '');

  const grandTotal = totalAmount + arrearsOnBill - creditApplied;
  const cumulativePaid = existingPaid + amountPaid;
  const newRemainingArrears = Math.max(0, grandTotal - cumulativePaid);
  const newCredit = Math.max(0, cumulativePaid - grandTotal);
  const newStatus = cumulativePaid >= grandTotal ? 'PAID' : 'PARTIAL';

  const sheetRow = rowIndex + 2;
  const updateValues = [[newRemainingArrears, totalAmount, cumulativePaid, newStatus, existingUrl]];

  await updateSheetValues(`${SHEET_INVOICES}!H${sheetRow}:L${sheetRow}`, updateValues);

  const roomId = String(rows[rowIndex][1] ?? '').trim();
  const currentInvoicePeriod = String(rows[rowIndex][2] ?? '').trim();

  if (newStatus === 'PAID') {
    const batchUpdates: { range: string; values: string[][] }[] = [];
    rows.forEach((row, idx) => {
      if (idx === rowIndex) return;
      const rRoomId = String(row[1] ?? '').trim();
      const rPeriod = String(row[2] ?? '').trim();
      const rStatus = String(row[10] ?? '').trim();
      if (rRoomId === roomId && (rStatus === 'UNPAID' || rStatus === 'PARTIAL') && rPeriod < currentInvoicePeriod) {
        batchUpdates.push({ range: `${SHEET_INVOICES}!K${idx + 2}`, values: [['PAID']] });
      }
    });
    if (batchUpdates.length > 0) await batchUpdateSheetValues(batchUpdates);
  }

  if (newCredit > 0) {
    const roomRows = await getSheetValues(`${SHEET_ROOMS}!A2:F`);
    const roomRowIndex = roomRows.findIndex((r) => String(r[0] ?? '').trim() === roomId);
    if (roomRowIndex !== -1) {
      const existing_credit = Math.max(0, parseFloat(String(roomRows[roomRowIndex][4] ?? '')) || 0);
      const roomSheetRow = roomRowIndex + 2;
      await updateSheetValues(`${SHEET_ROOMS}!E${roomSheetRow}`, [[existing_credit + newCredit]]);
    }
  }

  return { roomId, totalAmount: grandTotal, newCredit, cumulativePaid, newStatus };
}

export async function saveTenant(tenant: Tenant): Promise<void> {
  const row = [
    tenant.tenantId, tenant.firstname, tenant.lastname, tenant.phone,
    tenant.room_id, tenant.entryDate, tenant.status, tenant.lineUserId ?? ''
  ];
  await appendSheetValues(`${SHEET_TENANTS}!A1`, [row]);
}

// --- Users ------------------------------------------------------------------

import type { User, Role } from '@/types/auth';

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const rows = await getSheetValues(`${SHEET_USERS}!A2:C`);
    const userRow = rows.find((row) => String(row[0] ?? '').trim() === username);
    if (!userRow) return null;

    return {
      username: String(userRow[0] ?? '').trim(),
      passwordHash: String(userRow[1] ?? '').trim(),
      role: String(userRow[2] ?? '').trim() as Role,
    };
  } catch (error) {
    console.error('Failed to get user from sheet:', error);
    return null;
  }
}

// --- Expenses ----------------------------------------------------------------

import type { Expense } from '@/types';

export async function getExpenses(): Promise<Expense[]> {
  try {
    const rows = await getSheetValues(`${SHEET_EXPENSES}!A2:E`);
    return rows.map((row) => ({
      id: String(row[0] ?? ''),
      date: String(row[1] ?? ''),
      category: String(row[2] ?? '') as Expense['category'],
      description: String(row[3] ?? ''),
      amount: Number(row[4] ?? 0),
    })).filter(e => e.id !== '');
  } catch (error) {
    console.error('Failed to get expenses:', error);
    return [];
  }
}

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
  const id = `EXP-${Date.now()}`;
  const row = [id, expense.date, expense.category, expense.description, expense.amount];
  await appendSheetValues(`${SHEET_EXPENSES}!A1`, [row]);
  return { id, ...expense };
}
