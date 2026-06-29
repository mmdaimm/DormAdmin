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
    range: `${SHEET_ROOMS}!A2:F`,
  });

  const rows = response.data.values ?? [];

  return rows
    .filter((row) => row[0]) // skip blank rows
    .map((row): Room => ({
      roomId: String(row[0] ?? '').trim(),
      roomNumber: String(row[1] ?? '').trim(),
      monthlyRent: parseFloat(row[2]) || 0,
      lineToken: String(row[3] ?? '').trim(),
      creditBalance: Math.max(0, parseFloat(row[4] as string) || 0),
      depositAmount: parseFloat(row[5] as string) || 0,
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
    remainingArrears: parseFloat(row[12] as string) || 0,
    creditApplied: parseFloat(row[15] as string) || 0,
    isNewFormat: row.length >= 14,
    proratedAmount: row[14] ? parseFloat(row[14] as string) : 0,
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
    range: `${SHEET_INVOICES}!A2:P`,
  });

  const rows = response.data.values ?? [];

  // Filter for the room, sort by period descending, and return the first match.
  const roomInvoices = rows
    .filter((row) => String(row[1] ?? '').trim() === roomId)
    .map(rowToInvoice)
    .sort((a, b) => b.period.localeCompare(a.period));
    
  return roomInvoices.length > 0 ? roomInvoices[0] : null;
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
    range: `${SHEET_INVOICES}!A2:P`,
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
      // ไม่ได้จ่ายเลย — ยกยอด total_amount ทั้งก้อน
      return lastInvoice.totalAmount;

    case 'PARTIAL':
      // จ่ายบางส่วน — ยกเฉพาะยอดที่ค้างอยู่จาก Column H
      return lastInvoice.arrears;

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
    invoiceData.invoiceId,           // A (Index 0)
    invoiceData.roomId,              // B (Index 1)
    invoiceData.period,              // C (Index 2)
    invoiceData.prevMeter,           // D (Index 3)
    invoiceData.currMeter,           // E (Index 4)
    invoiceData.waterBill,           // F (Index 5)
    invoiceData.otherBill,           // G (Index 6)
    invoiceData.arrears,             // H (Index 7) ← arrears carry-over
    invoiceData.totalAmount,         // I (Index 8) ← current month ONLY
    0,                               // J (Index 9) paid_amount = 0
    'UNPAID',                        // K (Index 10) status
    invoiceData.pdfUrl ?? '',        // L (Index 11) url_invoice = preserve URL
    invoiceData.arrears,             // M (Index 12) ← old_arrears = snapshot of H
    '',                              // N (Index 13) discount_amount
    invoiceData.proratedAmount || 0, // O (Index 14) prorated_amount
    invoiceData.creditApplied ?? 0,  // P (Index 15)
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
export async function processPayment(
  invoiceId: string,
  amountPaid: number
): Promise<{ roomId: string; totalAmount: number; newCredit: number }> {
  // 1. Fetch full Invoices sheet to locate the row and verify live status.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!A2:P`,
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

  // 3. Securely parse existing values
  const totalAmount    = parseFloat(String(rows[rowIndex][8] ?? '')) || 0;  // I
  const arrearsOnBill  = parseFloat(String(rows[rowIndex][7] ?? '')) || 0;  // H
  const creditApplied  = parseFloat(String(rows[rowIndex][15] ?? '')) || 0; // P
  const existingPaid   = parseFloat(String(rows[rowIndex][9] ?? '')) || 0;  // J
  const existingUrl    = String(rows[rowIndex][11] ?? '');                  // L

  // 4. Calculate actual payable
  const grandTotal = totalAmount + arrearsOnBill - creditApplied;

  // 5. Evaluate amountPaid against grandTotal
  const cumulativePaid = existingPaid + amountPaid;
  const newRemainingArrears = Math.max(0, grandTotal - cumulativePaid);
  const newCredit = Math.max(0, cumulativePaid - grandTotal);

  const newStatus = cumulativePaid >= grandTotal ? 'PAID' : 'PARTIAL';

  // 6. Update invoices tab
  const sheetRow = rowIndex + 2;
  
  const updateValues = [[
    newRemainingArrears, // H (Index 7)
    totalAmount,         // I (Index 8)
    cumulativePaid,      // J (Index 9)
    newStatus,           // K (Index 10)
    existingUrl,         // L (Index 11)
  ]];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_INVOICES}!H${sheetRow}:L${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: updateValues },
  });

  const roomId = String(rows[rowIndex][1] ?? '').trim();
  const currentInvoicePeriod = String(rows[rowIndex][2] ?? '').trim();

  // 6.5. Cascading 'PAID' status to old invoices
  if (newStatus === 'PAID') {
    const batchUpdates: { range: string; values: string[][] }[] = [];
    rows.forEach((row, idx) => {
      if (idx === rowIndex) return; // Skip the current invoice
      const rRoomId = String(row[1] ?? '').trim();
      const rPeriod = String(row[2] ?? '').trim();
      const rStatus = String(row[10] ?? '').trim();
      if (rRoomId === roomId && (rStatus === 'UNPAID' || rStatus === 'PARTIAL') && rPeriod < currentInvoicePeriod) {
        batchUpdates.push({
          range: `${SHEET_INVOICES}!K${idx + 2}`,
          values: [['PAID']],
        });
      }
    });

    if (batchUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: batchUpdates,
        },
      });
    }
  }

  // 7. CREDIT BALANCE UPDATE
  if (newCredit > 0) {
    const roomRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_ROOMS}!A2:F`,
    });
    
    const roomRows = roomRes.data.values ?? [];
    const roomRowIndex = roomRows.findIndex((r) => String(r[0] ?? '').trim() === roomId);
    
    if (roomRowIndex !== -1) {
      const existing_credit = Math.max(0, parseFloat(String(roomRows[roomRowIndex][4] ?? '')) || 0);
      const roomSheetRow = roomRowIndex + 2;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_ROOMS}!E${roomSheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[existing_credit + newCredit]] },
      });
    }
  }

  return { roomId, totalAmount: grandTotal, newCredit };
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
