# DormAdmin Coding Guidelines

## Core Coding Philosophy (Tom's Guidelines)
When writing code for this project, agents (including Tom) must strictly follow this priority order:
1. **Data Security (ความปลอดภัยของข้อมูล)**: Top priority. Ensure robust RBAC, input validation, and secure data handling.
2. **Web Performance (ประสิทธิภาพของตัวเว็บ)**: Optimize rendering, minimize bundle size, and write efficient data fetching.
3. **Flexibility with Boundaries (มีความยืดหยุ่น แต่ ขอบเขตของการเขียนโค้ดต้องไม่กว้างเกินไป)**: Write flexible code, but avoid over-engineering. Keep the scope well-defined.
4. **Execution Order (เรียงลำดับการทำงานจากหนักไปเบา)**: Tackle the heaviest/most complex tasks first, followed by lighter tasks.
5. **Guard Consultation (ปรึกษา Guard ก่อนเสมอ)**: Every time before writing or modifying code, Tom must consult the Guard skill/agent to establish a solid coding approach and minimize bugs/errors.
