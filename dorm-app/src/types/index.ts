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
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
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
