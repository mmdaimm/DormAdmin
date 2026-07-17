---
name: business-logic
description: Formulas, payment rules, and core business logic for the DormAdmin system.
---

# DormAdmin Business Logic

This document defines the strict business rules and calculations used in the Dormitory Management System. Always refer to these formulas before writing any calculation logic. The single source of truth for invoice math is `src/services/invoiceCalculator.ts`.

## 1. 🧾 Invoice Calculation (การคำนวณบิล)
Invoices are calculated fresh every time they are generated or previewed to prevent tampering.

### Variables & Constants
- `monthlyRent`: Base rent of the room (from `SHEET_ROOMS`)
- `proratedAmount`: Discount applied when moving in mid-month.
- `electricRate`: Electric rate per unit (from `SHEET_SETTINGS`, typically 8)
- `waterRate`: Fixed water bill per month (from `SHEET_SETTINGS`, typically 60)
- `otherBill`: Any additional manual charges (e.g., parking, fines)

### Formulas
```javascript
unitsUsed = currMeter - prevMeter
electricityBill = unitsUsed * electricRate
currentMonthTotal = (monthlyRent - proratedAmount) + electricityBill + waterRate + otherBill

// Arrears (ยอดหนี้คงค้างยกมา)
arrears = calculateArrears(lastInvoice) 
// -> If last invoice is UNPAID: 
//      - New format (isNewFormat): arrears = lastInvoice.totalAmount + (lastInvoice.remainingArrears ?? 0) - (lastInvoice.creditApplied ?? 0)
//      - Old format: arrears = lastInvoice.totalAmount
// -> If last invoice is PARTIAL: arrears = lastInvoice.arrears (unpaid remainder because Col H is mutated by partial payments)
// -> If last invoice is PAID: arrears = 0

preliminaryTotal = currentMonthTotal + arrears
creditApplied = Math.min(preliminaryTotal, room.creditBalance)
grandTotal = preliminaryTotal - creditApplied
```
*(See `computeInvoiceValues` in `src/services/invoiceCalculator.ts`)*

## 2. 💸 Payment & Overpayment (การชำระเงินและเครดิต)
When a tenant pays an invoice, the system must handle partial payments and overpayments smoothly. 

- `grandTotal` (ยอดรวมสุทธิ) = `totalAmount + arrears - creditApplied`
- `cumulativePaid` = `existingPaid + amountPaid` (How much they have paid in total for this specific invoice so far)

### Rules
1. **PARTIAL (จ่ายไม่ครบ):** If `cumulativePaid < grandTotal`, the invoice status becomes `PARTIAL`. The remaining debt is saved as `newRemainingArrears = grandTotal - cumulativePaid`.
2. **PAID (จ่ายครบพอดี):** If `cumulativePaid === grandTotal`, the invoice status becomes `PAID`. `newRemainingArrears = 0`.
3. **OVERPAYMENT (จ่ายเกิน):** If `cumulativePaid > grandTotal`, the invoice status becomes `PAID`. The excess amount becomes `newCredit = cumulativePaid - grandTotal`. This `newCredit` is saved to the Room's `creditBalance` and automatically deducted in the next month's bill.

*(See `processPayment` in `src/services/sheetService.ts`)*

## 3. 🚨 Edge Cases & Validations
- **Meter Validation:** `currMeter` must NEVER be less than `prevMeter`. The API must throw a `422 Unprocessable Entity`.
- **Duplicate Invoice:** A room cannot have two invoices for the same `period` (YYYY-MM). The API must throw a `409 Conflict`.
- **Architecture of Arrears (Column H vs Column M):** 
  - `invoice.arrears` (Col H) is a **dynamic variable (Mutated State)**. It starts as the "debt brought into this month". However, when `processPayment()` handles a PARTIAL payment, it writes the *new remaining balance* over Column H. Thus, for a PARTIAL invoice, Col H holds the actual remaining debt.
  - `invoice.remainingArrears` (Col M) is a **frozen snapshot (Immutable State)** of the debt at the exact moment the invoice was generated. It is NEVER modified by `processPayment()`. 
  - **Golden Rule:** If you need the "original debt brought into the month" (e.g., for Export CSV Grand Total calculation or reconstructing UNPAID debt), **always use Column M (`remainingArrears`)**. If you need the "current remaining balance" after payments (e.g., for PARTIAL `calculateArrears`), **use Column H (`arrears`)**.

## 4. 📦 Move-In / Move-Out (ยังไม่มีลอจิกซับซ้อนในเวอร์ชันปัจจุบัน)
- **Move-In:** A new tenant is created with `status: 'ACTIVE'`. First-month bills can use `proratedAmount` to reduce rent.
- **Move-Out:** Tenant status is set to `INACTIVE`. Any remaining `creditBalance` or unpaid invoices must be cleared manually by the Admin/Owner before finalizing.
