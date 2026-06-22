import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import { ELECTRIC_RATE_PER_UNIT, WATER_BILL_FIXED } from '@/config/dorm';
import type { Invoice, Room, SettingRate } from '@/types';

// ─── Sheet name constants ─────────────────────────────────────────────────────

const SHEET_SETTINGS = 'Settings';
const SHEET_ROOMS = 'Rooms';
const SHEET_INVOICES = 'Invoices';

// ─── Column layout assumptions ────────────────────────────────────────────────
//
// Settings  : A=key | B=value | C=description
// Rooms     : A=roomId | B=roomNumber | C=monthlyRent | D=lineToken
// Invoices  : A=invoiceId | B=roomId | C=period | D=prevMeter | E=currMeter
//             F=waterBill | G=otherBill | H=arrears | I=totalAmount
//             J=paidAmount | K=status

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
    range: `${SHEET_INVOICES}!A2:K`,
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
