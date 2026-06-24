import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import { ELECTRIC_RATE_PER_UNIT, WATER_BILL_FIXED } from '@/config/dorm';
import type { Invoice, Room, SettingRate, Tenant } from '@/types';

// ─── Sheet name constants ─────────────────────────────────────────────────────

export const SHEET_SETTINGS = 'Settings';
const SHEET_ROOMS = 'Rooms';
const SHEET_INVOICES = 'Invoices';
const SHEET_TENANTS = 'Tenants';

// ─── Column layout assumptions ──────────────────────────────────────────────────────────
//
// Settings  : A=key | B=value | C=description
// Rooms     : A=roomId | B=roomNumber | C=monthlyRent | D=lineToken
// Invoices  : A=invoiceId | B=roomId | C=period | D=prevMeter | E=currMeter
//             F=waterBill | G=otherBill | H=arrears | I=totalAmount
//             J=paidAmount | K=status
// Tenants   : A=tenantId | B=firstname | C=lastname | D=phone
//             E=room_id | F=entryDate | G=status

// ─── Rates ────────────────────────────────────────────────────────────────────

/**
 * Resolved utility rates used for billing.
 */
export interface Rates {
  electricRate: number; // Baht per kWh
  waterRate: number;    // Baht flat per period
}

/**
 * Fetches 'electric_rate' and 'water_rate' from the **Settings** sheet.
 * Falls back to the constants defined in `dorm.ts` if the sheet is empty
 * or a specific key is missing.
 *
 * Expected sheet columns: A=key, B=value, C=description
 */
export async function getRates(): Promise<Rates> {
  const rates: Rates = {
    electricRate: ELECTRIC_RATE_PER_UNIT,
    waterRate: WATER_BILL_FIXED,
  };

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      // Row 1 is the header; data starts at row 2.
      range: `${SHEET_SETTINGS}!A2:C`,
    });

    const rows = response.data.values ?? [];

    for (const row of rows) {
      const key = (row[0] as string | undefined)?.trim() as SettingRate['key'];
      const rawValue = row[1] as string | undefined;
      const parsed = rawValue !== undefined ? parseFloat(rawValue) : NaN;

      if (isNaN(parsed)) continue;

      if (key === 'electric_rate') {
        rates.electricRate = parsed;
      } else if (key === 'water_rate') {
        rates.waterRate = parsed;
      }
    }
  } catch (error) {
    // Non-fatal: log and continue with fallback values.
    console.warn(
      '[sheetService.getRates] Failed to fetch settings — using defaults.',
      error
    );
  }

  return rates;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

/**
 * Fetches all rooms from the **Rooms** sheet.
 *
 * Expected sheet columns: A=roomId, B=roomNumber, C=monthlyRent, D=lineToken
 */
export async function getRooms(): Promise<Room[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_ROOMS}!A2:D`,
  });

  const rows = response.data.values ?? [];

  return rows
    .filter((row) => row[0]) // skip blank rows
    .map((row): Room => ({
      roomId: String(row[0] ?? '').trim(),
      roomNumber: String(row[1] ?? '').trim(),
      monthlyRent: parseFloat(row[2]) || 0,
      lineToken: String(row[3] ?? '').trim(),
    }));
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

/**
 * Maps a raw sheet row (index 0-based, starting from column A) to an Invoice.
 */
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
  };
}

/**
 * Finds the **most recent** invoice row for a given room by scanning the
 * Invoices sheet and returning the last matching row.
 *
 * "Most recent" is defined by position (the last row in the sheet for that
 * room), which mirrors append-only write order used by `saveInvoice`.
 *
 * Returns `null` if no invoice exists for the room yet.
 */
export async function getLastInvoiceByRoom(
  roomId: string
): Promise<Invoice | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!A2:L`,
  });

  const rows = response.data.values ?? [];

  // Iterate in reverse so the first match is the most recent row.
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (String(row[1] ?? '').trim() === roomId) {
      return rowToInvoice(row);
    }
  }

  return null;
}

/**
 * Fetches **every** invoice row from the Invoices sheet in a single API call.
 *
 * Use this when you need data for multiple rooms at once (e.g. the rooms list
 * endpoint) to avoid N+1 requests. Filter and group the result in memory.
 *
 * Returns an empty array if the sheet has no data rows yet.
 */
export async function getAllInvoices(): Promise<Invoice[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!A2:L`,
  });

  const rows = response.data.values ?? [];
  return rows.filter((row) => row[0]).map(rowToInvoice);
}

// ─── Arrears ──────────────────────────────────────────────────────────────────

/**
 * Calculates the outstanding balance to carry forward from a previous invoice.
 *
 * | Previous status  | Arrears returned              |
 * |------------------|-------------------------------|
 * | `UNPAID`         | `totalAmount` (full balance)  |
 * | `PARTIALLY_PAID` | `totalAmount - paidAmount`    |
 * | `PAID`           | `0`                           |
 * | `null` (no prior invoice) | `0`                  |
 */
export function calculateArrears(lastInvoice: Invoice | null): number {
  if (!lastInvoice) return 0;

  switch (lastInvoice.status) {
    case 'UNPAID':
      return lastInvoice.totalAmount;

    case 'PARTIALLY_PAID':
      // Guard against negative arrears caused by data entry errors.
      return Math.max(0, lastInvoice.totalAmount - lastInvoice.paidAmount);

    case 'PAID':
    default:
      return 0;
  }
}

// ─── Save Invoice ─────────────────────────────────────────────────────────────

/**
 * Appends a new invoice as a single row at the bottom of the **Invoices** sheet.
 *
 * Column order matches `rowToInvoice` so reads and writes stay in sync:
 * A=invoiceId, B=roomId, C=period, D=prevMeter, E=currMeter,
 * F=waterBill, G=otherBill, H=arrears, I=totalAmount, J=paidAmount, K=status
 */
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
    invoiceData.paidAmount,
    invoiceData.status,
    invoiceData.pdfUrl ?? '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

/**
 * Maps a raw Tenants sheet row to a Tenant object.
 * Column order: A=tenantId, B=firstname, C=lastname, D=phone, E=room_id, F=entryDate, G=status
 */
function rowToTenant(row: unknown[]): Tenant {
  return {
    tenantId:   String(row[0] ?? '').trim(),
    firstname:  String(row[1] ?? '').trim(),
    lastname:   String(row[2] ?? '').trim(),
    phone:      String(row[3] ?? '').trim(),
    room_id:    String(row[4] ?? '').trim(),
    entryDate:  String(row[5] ?? '').trim(),
    status:     ((row[6] as string | undefined)?.trim() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
    // Column H — optional; undefined when cell is blank
    lineUserId: row[7] ? String(row[7]).trim() : undefined,
  };
}

/**
 * Fetches all tenant records from the **Tenants** sheet.
 * Returns an empty array if the sheet has no data rows yet.
 */
export async function getTenants(): Promise<Tenant[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    // A2:H — includes the optional lineUserId column (H)
    range: `${SHEET_TENANTS}!A2:H`,
  });

  const rows = response.data.values ?? [];
  return rows.filter((row) => row[0]).map(rowToTenant);
}

/**
 * Marks an invoice as PAID by updating **only column K** of the matching row.
 *
 * Concurrency guard: the current status is re-read from the sheet immediately
 * before the write. If it is already 'PAID', the function throws instead of
 * writing — preventing double-payment races where two browser tabs submit
 * the same invoice simultaneously.
 *
 * Returns `{ roomId, totalAmount }` extracted from the row that was already
 * fetched during the concurrency guard — so the caller does NOT need to fetch
 * the Invoices sheet a second time for downstream actions (e.g. LINE push).
 *
 * @throws {Error} If the invoice is not found or is already PAID.
 */
export async function markInvoicePaid(
  invoiceId: string
): Promise<{ roomId: string; totalAmount: number }> {
  // 1. Fetch full Invoices sheet to locate the row and verify live status.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!A2:L`,
  });

  const rows = response.data.values ?? [];
  const rowIndex = rows.findIndex(
    (row) => String(row[0] ?? '').trim() === invoiceId
  );

  if (rowIndex === -1) {
    throw new Error(`ไม่พบใบแจ้งหนี้รหัส "${invoiceId}" ในระบบ`);
  }

  // 2. Concurrency guard: abort if someone else already paid this invoice.
  const currentStatus = String(rows[rowIndex][10] ?? '').trim();
  if (currentStatus === 'PAID') {
    throw new Error(`ใบแจ้งหนี้ "${invoiceId}" ถูกบันทึกว่าชำระแล้ว`);
  }

  // 3. Extract fields needed by the caller — reuse data already in memory.
  //    Invoices column layout: B=roomId (index 1), I=totalAmount (index 8)
  const roomId     = String(rows[rowIndex][1] ?? '').trim();
  const totalAmount = parseFloat(String(rows[rowIndex][8] ?? '')) || 0;

  // 4. Row 1 is the header; data starts at row 2 → sheet row = rowIndex + 2.
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    // Target column K only — leaves all other columns untouched.
    range: `${SHEET_INVOICES}!K${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['PAID']] },
  });

  return { roomId, totalAmount };
}

/**
 * Appends a new tenant record to the **Tenants** sheet.
 * Column order mirrors `rowToTenant` so reads and writes stay in sync.
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
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TENANTS}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}
