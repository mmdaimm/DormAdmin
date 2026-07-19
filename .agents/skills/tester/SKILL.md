---
name: tester
description: Test the dormitory management system's business logic, including rent calculation, invoice/receipt generation, and tenant move-in/move-out workflows.
---

# Dormitory System Tester Skill

You have been invoked to test the business logic of the DormAdmin (Dormitory Management System). Follow these guidelines meticulously to ensure the system is working correctly.

## 1. Testing Scope
When testing, ensure you cover the following core business logic areas:
- **Rent Calculation:** Verify base rent, prorated rent calculation, utility calculations (water/electricity meters units and rates), and carry-over arrears (ยอดค้างชำระ). Ensure no double-counting of debt.
- **Billing Workflow (Invoice):** Verify that Invoices (ใบแจ้งหนี้) are generated correctly: 1. DB Save -> 2. PDF Gen -> 3. R2 Upload -> 4. URL Patch.
- **Payment & Receipts:** Verify partial payments, full payments, carry-over debt updates, and Receipt (ใบเสร็จรับเงิน) layout and logic (Grand Total, Amount Paid, Remaining Balance).
- **Move-In / Move-Out:** Verify adding a new tenant (creating initial meter readings) and moving out a tenant (final calculation, clearing active status).

## 2. Testing Methodology
- **Deep User Journey Testing (No Silos):** Do not just test a single file or route in isolation. Trace the full user journey from the UI to the API to the Database to ensure all parts connect properly.
- **Integration & Cross-dependency Checks:** If testing a security or routing feature (like Middleware or RBAC), always verify that the restrictions do not inadvertently block legitimate requests needed by other allowed pages.
- **Variable Expansion & Typo Checks:** Carefully scrutinize string interpolations, file paths, and database query ranges (especially Google Sheet ranges) to catch missing variables or syntax typos.
- **Edge Cases:** Pay special attention to nullish coalescing, falsy zero bugs (`0` vs `null`), missing snapshots, and negative payment amounts.

## 3. Reporting and Handoff to Tom
After you finish your review and testing:
- If no bugs are found, summarize the areas you have checked and confirm the system is stable.
- If you find bugs or errors, you **MUST** first write a report addressed to the User summarizing the bugs you found and their impact.
- In the same response, you **MUST** also compile those bugs into a detailed prompt addressed to `Tom`.
- The prompt must clearly state what the bugs are, where they occurred, and how they should be fixed.
- Send this response to the chat so that the User is informed, and `Tom` can immediately pick it up and apply the fixes.
