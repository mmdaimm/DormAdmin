// ─── Room ────────────────────────────────────────────────────────────────────
export interface Room {
  /** Unique identifier stored in the sheet (e.g. "R01"). */
  roomId: string;
  /** Human-readable room label shown in the UI (e.g. "101"). */
  roomNumber: string;
  /** Base monthly rent in Baht, excluding utilities. */
  monthlyRent: number;
  /** LINE Notify token used to push payment notifications to the tenant. */
  lineToken: string;
  /** Accumulated overpayment credit available to offset future bills. */
  creditBalance?: number;
  /** Deposit amount paid by the tenant. */
  depositAmount?: number;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
/**
 * Represents one tenant record as stored in the "Tenants" sheet.
 *
 * Field names match the sheet columns exactly (snake_case preserved):
 * A=tenantId | B=firstname | C=lastname | D=phone | E=room_id | F=entryDate | G=status
 */
export interface Tenant {
  tenantId: string;
  firstname: string;
  lastname: string;
  /** Thai mobile number — must be exactly 10 digits (validated on save). */
  phone: string;
  /** Foreign key → Room.roomId (snake_case to match sheet header). */
  room_id: string;
  /** Move-in date in ISO format: YYYY-MM-DD */
  entryDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** LINE User ID for push notifications via the Messaging API (column H). */
  lineUserId?: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export interface Invoice {
  /** Unique identifier stored in the sheet (e.g. "INV-2024-06-01"). */
  invoiceId: string;
  /** Foreign key → Room.roomId */
  roomId: string;
  /**
   * Billing month in ISO-like format: YYYY-MM
   * @example "2024-06"
   */
  period: string;
  /** Previous electricity meter reading (kWh). */
  prevMeter: number;
  /** Current electricity meter reading (kWh). */
  currMeter: number;
  /** Fixed water charge for the billing period (Baht). */
  waterBill: number;
  /** Miscellaneous charges, e.g. parking, cleaning (Baht). */
  otherBill: number;
  /** Unpaid balance carried forward from previous periods (Baht). */
  arrears: number;
  /** Grand total due = rent + electricity + waterBill + otherBill + arrears (Baht). */
  totalAmount: number;
  /** Amount the tenant has already paid toward this invoice (Baht). */
  paidAmount: number;
  /**
   * Monthly base rent at the time the invoice was issued (Baht).
   * Optional — populated by the API response but not stored in the sheet
   * (the sheet row already contains totalAmount which subsumes rent).
   * Used by SlipPdf to display rent directly without floating-point back-calculation.
   */
  monthlyRent?: number;
  /** Payment status of this invoice. */
  status: 'PAID' | 'UNPAID' | 'PARTIAL';
  /**
   * Cloudflare R2 public URL of the uploaded PDF bill.
   * Optional — populated after the client uploads the PDF blob to R2.
   * Stored in the sheet as column L; used by the LINE push notification.
   */
  pdfUrl?: string;
  /**
   * Remaining arrears after a partial payment.
   * Stored in the sheet as column M (Index 12).
   */
  remainingArrears?: number;
  /**
   * Credit applied to this invoice.
   * Stored in the sheet as column P (Index 15).
   */
  creditApplied?: number;
  /** Whether this invoice uses the new format where totalAmount = current_month_total */
  isNewFormat?: boolean;
  /** Pro-rated discount amount for tenants moving in mid-month (Baht). */
  proratedAmount?: number;
}

// ─── SettingRate ──────────────────────────────────────────────────────────────
export interface SettingRate {
  /** Identifies which utility rate this row represents. */
  key: 'electric_rate' | 'water_rate';
  /** Rate value — Baht per kWh for electricity, Baht flat for water. */
  value: number;
  /** Human-readable explanation shown in the settings UI. */
  description: string;
}

export * from './auth';
