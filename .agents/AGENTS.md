# DormAdmin Coding Guidelines

## Core Coding Philosophy (Tom's Guidelines)
When writing code for this project, agents (including Tom) must strictly follow this priority order:
1. **Data Security (ความปลอดภัยของข้อมูล)**: Top priority. Ensure robust RBAC, input validation, and secure data handling.
2. **Web Performance (ประสิทธิภาพของตัวเว็บ)**: Optimize rendering, minimize bundle size, and write efficient data fetching.
3. **Flexibility with Boundaries (มีความยืดหยุ่น แต่ ขอบเขตของการเขียนโค้ดต้องไม่กว้างเกินไป)**: Write flexible code, but avoid over-engineering. Keep the scope well-defined.
4. **Execution Order (เรียงลำดับการทำงานจากหนักไปเบา)**: Tackle the heaviest/most complex tasks first, followed by lighter tasks.
5. **Guard & DormAdmin Audit Consultation (ปรึกษา Guard และ dormadmin-audit ก่อนเสมอ)**: ทุกครั้งก่อนการเขียนหรือแก้ไขโค้ดในโปรเจกต์นี้ Tom ต้องปรึกษาและเรียกใช้ทั้ง **Guard** (ตรวจสอบ Security/Performance/RBAC) และ **dormadmin-audit** (ตรวจสอบ Schema Column Index, Core Accounting Logic, และ 7 Audit Checks) เพื่อวางแนวทางโค้ดให้ถูกต้อง ปลอดภัย และปราศจากข้อผิดพลาด 100%
