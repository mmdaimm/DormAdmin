---
name: database-schema
description: Reference for DormAdmin Google Sheets / Mock JSON Database Schema and Column Mappings.
---

# DormAdmin Database Schema & Mapping

This document describes the structure of the Google Sheets database (and its JSON equivalent `mock_db.json`). All data fetching and mapping happens in `src/services/sheetService.ts`.

## 1. 📄 Invoices (`SHEET_INVOICES`)
Manages all billing data. This is the most complex table.

**Column Mapping:**
- **[0] Col A** `invoiceId` (string) - Format: `INV-{roomId}-{YYYY-MM}`
- **[1] Col B** `roomId` (string)
- **[2] Col C** `period` (string) - Format: `YYYY-MM`
- **[3] Col D** `prevMeter` (number) - Electricity meter from last month
- **[4] Col E** `currMeter` (number) - Current electricity meter
- **[5] Col F** `waterBill` (number) - Usually fixed rate
- **[6] Col G** `otherBill` (number) - Additional charges
- **[7] Col H** `arrears` (number) - Unpaid balance *updated during partial payments*
- **[8] Col I** `totalAmount` (number) - New charges for this month
- **[9] Col J** `paidAmount` (number) - Cumulative amount paid by tenant
- **[10] Col K** `status` (string) - `UNPAID` | `PARTIAL` | `PAID`
- **[11] Col L** `pdfUrl` (string) - URL to uploaded receipt PDF
- **[12] Col M** `remainingArrears` (number) - Snapshot of old debt at the time of invoice creation (Immutable after generation)
- **[13] Col N** `_blank` (empty string) - Legacy/Unused
- **[14] Col O** `proratedAmount` (number) - Discount for mid-month move-in
- **[15] Col P** `creditApplied` (number) - Credit used to offset this bill

> [!WARNING]
> Do NOT use `arrears` (Col H) for UI display of "Old Debt" when showing Grand Totals, because it shrinks as partial payments are made. Always use `remainingArrears` (Col M) for the snapshot of old debt carried over into this bill.

## 2. 🏠 Rooms (`SHEET_ROOMS`)
Manages room configuration and credit balances.

**Column Mapping:**
- **[0] Col A** `roomId` (string) - e.g., "101"
- **[1] Col B** `roomNumber` (string) - e.g., "101"
- **[2] Col C** `monthlyRent` (number) - Base rent
- **[3] Col D** `lineToken` (string) - Room's Line Notify token
- **[4] Col E** `creditBalance` (number) - Overpayment credit (used automatically on next bill)
- **[5] Col F** `depositAmount` (number) - Security deposit

## 3. 👤 Tenants (`SHEET_TENANTS`)
Manages tenant lifecycles.

**Column Mapping:**
- **[0] Col A** `tenantId` (string) - `T-{timestamp}`
- **[1] Col B** `firstname` (string)
- **[2] Col C** `lastname` (string)
- **[3] Col D** `phone` (string)
- **[4] Col E** `room_id` (string)
- **[5] Col F** `entryDate` (string) - `YYYY-MM-DD`
- **[6] Col G** `status` (string) - `ACTIVE` | `INACTIVE`
- **[7] Col H** `lineUserId` (string) - Optional line user id

## 4. ⚙️ Settings (`SHEET_SETTINGS`)
Global config.

**Column Mapping:**
- **[0] Col A** `key` (string) - `electric_rate`, `water_rate`
- **[1] Col B** `value` (string/number)
- **[2] Col C** `description` (string)

## 5. 💰 Expenses (`SHEET_EXPENSES`)
Accounting data.

**Column Mapping:**
- **[0] Col A** `id` (string) - `EXP-{timestamp}`
- **[1] Col B** `date` (string) - `YYYY-MM-DD`
- **[2] Col C** `category` (string) - `MAINTENANCE` | `UTILITY` | `OTHER`
- **[3] Col D** `description` (string)
- **[4] Col E** `amount` (number)
