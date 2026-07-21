# DormAdmin — Google Sheets Schema (Source of Truth)

ใช้ไฟล์นี้ cross-check ทุก column index ก่อน execute โค้ดที่แตะ Google Sheets

## Tab: `Rooms`
| Index | Column | Field | หมายเหตุ |
|---|---|---|---|
| 0 | A | `room_id` | Primary Key |
| 1 | B | `room_number` | |
| 2 | C | `monthly_rent` | |
| 3 | D | `line_token` | |
| 4 | E | `credit_balance` | ยอดเครดิตสะสม |
| 5 | F | `deposit_amount` | |

## Tab: `tenants`
| Index | Column | Field | หมายเหตุ |
|---|---|---|---|
| 0 | A | `tenant_id` | Primary Key |
| 1 | B | `firstname` | |
| 2 | C | `lastname` | |
| 3 | D | `phone` | |
| 4 | E | `room_id` | FK → Rooms |
| 5 | F | `entryDate` | format: YYYY-MM-DD |
| 6 | G | `status` | ACTIVE / INACTIVE |
| 7 | H | `lineUserId` | optional |

## Tab: `Invoices`
| Index | Column | Field | หมายเหตุ |
|---|---|---|---|
| 0 | A | `invoice_id` | Primary Key |
| 1 | B | `room_id` | FK → Rooms |
| 2 | C | `period` | format: YYYY-MM |
| 3 | D | `prev_meter` | |
| 4 | E | `curr_meter` | |
| 5 | F | `water_bill` | |
| 6 | G | `other_bill` | |
| 7 | H | `arrears` | ยอดค้างยกมา — อัปเดตได้หลังชำระ |
| 8 | I | `total_amount` | ค่าใช้จ่ายเดือนนี้ ONLY (ไม่รวม arrears) |
| 9 | J | `paid_amount` | ยอดชำระสะสม (cumulative) |
| 10 | K | `status` | UNPAID / PARTIAL / PAID |
| 11 | L | `url_invoice` | PDF URL — ห้าม overwrite ด้วย empty string |
| 12 | M | `old_arrears` | Immutable snapshot ตอนสร้างบิล — ห้ามแก้หลัง save. Frontend field name: `remainingArrears` |
| 13 | N | `discount_amount` | reserved |
| 14 | O | `prorated_amount` | ส่วนลดเข้าพักไม่เต็มเดือน |
| 15 | P | `credit_applied` | เครดิตที่นำมาหัก |

## Tab: `Settings`
ยังไม่มีการกำหนด schema — ใช้สำหรับการตั้งค่าระบบ

## Field Naming Convention

Google Sheets ใช้ snake_case (`room_id`, `total_amount`)
Frontend/TypeScript ใช้ camelCase (`roomId`, `totalAmount`)

**กฎ: ใช้ nullish coalescing fallback เสมอ (`??` ไม่ใช่ `||`)** ป้องกัน `0` ถูก treat เป็น falsy

**สำคัญ:** `invoice.remainingArrears` = `old_arrears` (Column M, Index 12) — นี่คือชื่อ field จริงที่ `rowToInvoice()` ใช้ ห้ามเพิ่ม field ใหม่ชื่ออื่น (เช่น `oldArrears`) ที่สื่อความหมายซ้ำกัน เพราะจะสร้างช่องให้ fallback chain พังแบบเงียบๆ

**ข้อควรระวังเรื่อง fallback chain ที่อันตราย:** ห้าม fallback จาก `remainingArrears` (M, immutable) ไปที่ `arrears` (H, mutable) เด็ดขาด เพราะเป็นคนละความหมายกัน (M คือ snapshot ตอนออกบิล, H เปลี่ยนได้หลังชำระ) การ fallback ข้ามกันจะทำให้ Grand Total ผิดในบาง edge case แบบเงียบๆ
