# Handoff Summary: DormAdmin (ระบบจัดการหอพัก)

## 📌 ภาพรวมสถาปัตยกรรม (Architecture & Tech Stack)
- **Framework:** Next.js (App Router), React, Tailwind CSS (Vanilla CSS + globals.css, ไม่ใช้ Tailwind UI components สำเร็จรูปตามกฎ)
- **Database:** Google Sheets API (`src/services/sheetService.ts`) ใช้เป็นฐานข้อมูลหลัก มีชีต `Rooms`, `Tenants`, `Invoices`, `Settings`, `Accounting`
- **File Storage:** Cloudflare R2 (`src/services/r2Service.ts`) สำหรับอัปโหลดและเก็บไฟล์ใบแจ้งหนี้/ใบเสร็จ (PDF)
- **PDF Generation:** ใช้ `puppeteer-core` ร่วมกับ `@sparticuz/chromium` (`src/services/pdfService.ts`)

## 🎨 การปรับแต่ง UI/UX ล่าสุด (Vibrant Dark Mode)
- เปลี่ยนดีไซน์ทั้งหมดให้เป็นสไตล์ **PostHog** (Vibrant Dark Theme)
- ใช้ฟอนต์ **IBM Plex Sans** (สำหรับข้อความหลัก) และ **IBM Plex Mono** (สำหรับตัวเลข/ยอดเงิน/ส่วนแสดงผลข้อมูล)
- ปรับใช้แม่สีสดจัดจ้าน (เช่น น้ำเงิน `#1d4aff`, แดง `#f33022`, เหลืองส้ม `#f7a501`, เขียว `#22c55e`)
- เปลี่ยนเงา (Shadow) ของปุ่มและการ์ดต่างๆ จากเงาฟุ้งสีดำ ให้เป็น **Hard Colored Shadows** (ตัวอย่าง: `shadow-[4px_4px_0_0_#1d4aff]`) และใช้ขอบทึบ (Solid Borders)
- อัปเดตครบทุกหน้า: Dashboard, Invoices, Invoice Manager, Accounting, Tenants, Settings, Sidebar, และ Login

## ⚙️ สถานะระบบหลังบ้าน (Backend & Business Logic)
- **ระบบออกบิล & จ่ายเงิน:**
  - สร้าง PDF สำเร็จ อัปโหลดขึ้น R2 สำเร็จ และเก็บ URL ลง Google Sheets
  - ระบบรับชำระเงินรองรับ **จ่ายเต็มจำนวน (Full Payment)** และ **จ่ายบางส่วน (Partial Payment)**
  - **[FIXED CRITICAL BUG]:** ป้องกันบั๊กการคำนวณยอดยกมา (Arrears) ผิดพลาดเวลาจ่ายบางส่วน โดยปรับ `sheetService.ts` (`processPayment` และ `calculateArrears`) ไม่ให้เขียนทับหนี้ตั้งต้นในคอลัมน์ H (old_arrears) แต่ใช้คอลัมน์ M (remainingArrears) แทนเพื่อรักษาประวัติที่ถูกต้อง
- **RBAC (Role-Based Access Control):**
  - จัดการสิทธิ์ด้วย `src/middleware.ts` 
  - `owner`: เข้าถึงได้ทุกหน้า และสามารถแก้ไขข้อมูลทางการเงินได้
  - `admin`: ห้ามเข้าถึงหน้า `/accounting`, `/settings`, `/tenants` และห้ามกดปุ่มจัดการเงิน (ปุ่มรับชำระ) หน้า UI จะแสดงเป็น Read-only

## 🤖 ข้อมูลสำหรับ Agent (Persona & Rules)
- กฎทั้งหมดถูกเก็บอยู่ที่โฟลเดอร์ `.agents/` ซึ่ง Agent จะโหลดอัตโนมัติ:
  - **Tom (Developer):** เน้นยืดหยุ่น แต่ปลอดภัย (Data Security > Web Performance > Flexibility) ต้องปรึกษา Guard ก่อนแก้โค้ดเสมอ
  - **Guard (Reviewer):** ตรวจสอบ Security/RBAC เชิงลึกแบบ Defense-in-Depth
  - **Tester (QA):** ทดสอบ Edge cases, สมการเงิน และความเชื่อมโยงต่างๆ
  - **Designer:** ดูแลให้ UI คงความสวยงามตามเรฟ PostHog 

## 🚀 เป้าหมายถัดไป: ระบบ ย้ายเข้า/ย้ายออก (Move-in / Move-out)
นี่คือฟีเจอร์ที่ต้องพัฒนาเป็นลำดับต่อไป:
1. **ย้ายเข้า (Move-in):** 
   - สร้างข้อมูลผู้เช่าใหม่ลงใน `SHEET_TENANTS`
   - ผูกผู้เช่าเข้ากับห้องว่างใน `SHEET_ROOMS` (อัปเดตสถานะห้อง)
   - บันทึกเลขมิเตอร์น้ำ/ไฟตั้งต้น
   - **(Optional):** ออกบิลค่ามัดจำแรกเข้า/ค่าเช่าล่วงหน้า
2. **ย้ายออก (Move-out):**
   - คำนวณค่าเช่าแบบ Prorated (ตามวันอยู่จริง) หรือเต็มเดือน
   - จดเลขมิเตอร์สุดท้าย เพื่อคิดค่าน้ำ/ค่าไฟรอบสุดท้าย
   - สรุปยอดหนี้ครั้งสุดท้าย (หักลบกับค่ามัดจำ)
   - เคลียร์ผู้เช่าออกจาก `SHEET_ROOMS` และปรับสถานะเป็น `INACTIVE` ใน `SHEET_TENANTS`

## 🛠️ วิธีการเริ่มทำงานในแชทใหม่
แค่ส่ง Prompt นี้:
> **"ช่วยอ่านไฟล์ `docs/handoff.md` เพื่อดูอัปเดตล่าสุด แล้วเริ่มทำระบบ Move-in / Move-out ต่อได้เลยครับ"**
ระบบจะสามารถสานต่องานจากจุดนี้ได้ทันทีโดยข้อมูลไม่สูญหาย!
