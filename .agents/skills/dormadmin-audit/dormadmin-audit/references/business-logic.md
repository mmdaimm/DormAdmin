# DormAdmin — Core Accounting Logic (ห้ามเปลี่ยนโดยไม่ได้รับอนุมัติ)

## 1. สูตรหลัก

```
Grand Total (แสดงผล/PDF) = total_amount + old_arrears - credit_applied
                           ← ใช้ old_arrears (M) ไม่ใช่ arrears (H)
                           ← ค่าคงที่ ไม่เปลี่ยนหลังสร้างบิล
                           ← ไม่มีเงื่อนไขยกเว้น (ห้ามมี isNewFormat หรือ flag อื่นมากันการรวม)

Remaining Balance = Math.max(0, Grand Total - paid_amount)
                   ← คำนวณ read-time เท่านั้น ไม่เก็บแยก

total_amount (Column I) = (monthly_rent - prorated_amount) + water_bill + other_bill
                          ← ไม่รวม arrears เด็ดขาด
```

## 2. Arrears Carry-over (ตอนสร้างบิลใหม่ และ การแสดงผลแบบ Dynamic)

```
Previous Invoice status:
  UNPAID  → arrearsToCarry = previous.total_amount + previous.old_arrears - previous.credit_applied - previous.paid_amount
  PARTIAL → arrearsToCarry = previous.arrears (Column H)
  PAID    → arrearsToCarry = 0

ตอน save บิลใหม่:
  H (arrears)     = arrearsToCarry   ← เปลี่ยนได้หลังชำระ
  M (old_arrears) = arrearsToCarry   ← frozen ตลอดไป ห้ามแก้

ตอนแสดงผล / GET API / PDF (Dynamic Effective Arrears Rule):
  ต้องประมวลผลไทม์ไลน์บิล period ASC ผ่าน computeEffectiveArrearsForInvoices()
  เพื่อคำนวณยอดยกมาตามยอดชำระเงินจริงล่าสุดเสมอ แม้ว่าจะมีการจ่ายเงินย้อนหลังในงวดเก่า
```

**Sequencing rule ที่สำคัญมาก:** arrears มาจากการคำนวณฝั่ง server เท่านั้น (`calculateArrears()`)
ห้ามสร้าง PDF หรือ artifact ใดๆ ที่ผูกกับยอด arrears **ก่อน** ที่ server จะคำนวณค่านี้เสร็จและส่งกลับมา
ถ้า flow ไหนสร้าง PDF จาก client-side object ก่อนเรียก API บันทึกบิล (เช่น `tempInvoice` ที่ hardcode
`arrears: 0`) แล้วเอา PDF นั้นไปอัปโหลดเป็น `url_invoice` ถาวร — PDF นั้นจะผิดตลอดไป ต่อให้แก้ rendering
logic ยังไงก็ตาม เพราะ input ผิดตั้งแต่ต้นทาง ต้อง flag เป็น 🔴 เสมอเมื่อเจอ pattern นี้

## 3. Payment Processing

```
grandTotal = total_amount + arrears (H) - credit_applied (P)

paid >= grandTotal → status = PAID, Column H = 0
paid < grandTotal  → status = PARTIAL, Column H = grandTotal - paid
paid > grandTotal  → status = PAID, Column H = 0
                     newCredit = paid - grandTotal → บวกเข้า rooms.credit_balance (Column E)

อัปเดต Range H:L เท่านั้น (5 elements):
[newArrears, totalAmount, cumulativePaid, newStatus, existingUrl]
ห้ามแตะ Column M (old_arrears) เด็ดขาด
```

## 4. Cascading PAID

```
เมื่อ invoice ถูก mark PAID:
→ หา invoice ของ room_id เดียวกันที่ status = UNPAID/PARTIAL
  AND period < currentInvoice.period (strict less than)
→ อัปเดต K (status) = PAID
→ ห้ามแตะ invoice ที่ period >= currentInvoice.period
```

## 5. Credit Balance

```
Overpayment → newCredit บวกเข้า rooms.credit_balance (Index 4)
สร้างบิลใหม่ → ดึง credit_balance มา apply:
  credit_applied = Math.min(preliminary_total, credit_balance)
  หลัง apply → ลด credit_balance ลงตามที่ใช้
```

## 6. Pro-Rate Calculation

```
เงื่อนไข: entryDate.startsWith(period) → ผู้เช่าเข้าเดือนนี้
Formula:
  daysStayed = totalDaysInMonth - moveInDay + 1
  actualProratedRent = Math.round((monthly_rent / totalDays) * daysStayed)
  prorated_amount (Column O) = monthly_rent - actualProratedRent
```

## 7. Meter Fetching

```
prevMeter = curr_meter ของ invoice ล่าสุด (sort by period DESC)
→ ไม่ filter ตาม status (UNPAID invoice ก็นับ)
→ Exclude CANCELLED/VOID เท่านั้น
```

## API Routes & Security

| Route | Method | หน้าที่ |
|---|---|---|
| `/api/invoices` | GET, POST | ดึง/สร้าง invoice |
| `/api/invoices/pay` | POST | รับชำระเงิน (รับแค่ `invoiceId`) |
| `/api/dashboard` | GET | KPI + invoice list (server-side grouped) |
| `/api/tenants` | GET, POST | จัดการ tenant |
| `/api/upload-bill` | POST | อัปโหลด PDF ไป Cloudflare R2 |
| `/api/send-line` | POST | ส่ง LINE notification (รับแค่ `invoiceId`) |

**SECURITY NOTE:** `/api/send-line` รับแค่ `invoiceId` — resolve `lineUserId` server-side เท่านั้น
ห้ามรับ `lineUserId` จาก client body

## Deferred Items (ยังไม่ implement — ทำทีหลัง ไม่ต้อง flag)

| รายการ | เหตุผลที่ defer |
|---|---|
| Authentication / Session (`getServerSession`) | ระบบยังไม่มี login — ทำพร้อมกันทุก route |
| Column N (`discount_amount`) | Reserved for future use |
| Column O (`prorated_amount`) UI polish | Implement แล้ว แต่ UI ยังไม่สมบูรณ์ |
