---
name: architecture-guidelines
description: Core architecture, routing, security (RBAC), and UI/UX conventions for DormAdmin.
---

# DormAdmin Architecture & Guidelines

This document outlines the architectural patterns, security rules, and UI/UX conventions used in the DormAdmin project. Always strictly adhere to these standards to maintain consistency and security.

## 1. 🏗️ Project Architecture
The project is built on Next.js (App Router) and uses a layered architecture to separate concerns.

- **`src/app/`**: Contains React components for the UI. Use `"use client"` for interactive pages.
- **`src/app/api/`**: Next.js Route Handlers (Backend API). These endpoints must **never** directly read/write from the database; they must call functions in `src/services/`.
- **`src/services/`**: The Business Logic layer. All calculations, data formatting, and database queries (`sheetService.ts`, `invoiceCalculator.ts`) happen here.
- **`src/lib/`**: Core utilities, such as `io.ts` (Google Sheets / Mock JSON wrapper) and `auth.ts` (JWT encryption/decryption).
- **`src/types/`**: TypeScript interfaces that define the exact shape of the data.

## 2. 🔐 Security & RBAC (Role-Based Access Control)
The system uses JWT-based authentication stored in HTTP-only cookies.
There are two roles: `owner` (full access) and `admin` (limited access).
RBAC is strictly enforced at the Edge level via `src/middleware.ts`.

### Admin Restrictions
- **Pages blocked for Admins:** `/settings`, `/tenants`, `/invoice-manager`, `/accounting`
- **APIs blocked for Admins:** 
  - `POST/PUT/DELETE` on `/api/settings`, `/api/tenants` (GET is allowed)
  - ALL methods on `/api/accounting`
  - `PUT` on `/api/invoices` (Mass assignment/manual overrides blocked. Generating invoices via `POST` is allowed).

> [!CAUTION]
> When modifying `middleware.ts`, ensure you do not accidentally block legitimate paths. Always verify the `pathname.startsWith()` logic.

## 3. 🛡️ Data Protection (Mock DB vs Production)
- The system can run in a mock mode using a local JSON file (`data/mock_db.json`).
- This file contains sensitive production-like data and MUST NEVER be committed to version control. The folder `/data/` is strictly ignored in `.gitignore`.
- Mass Assignment Prevention: When updating records (e.g., in `sheetService.ts`), explicitly whitelist the fields that can be updated (e.g., `UPDATABLE_INVOICE_FIELDS`) rather than spreading the entire payload `...updates`.

## 4. 🎨 UI/UX & Coding Conventions
- **Styling:** Use standard Tailwind CSS. The app uses a **Dark Theme (PostHog DevTool Style)**:
  - Backgrounds: `bg-slate-950`
  - Cards/Panels: `bg-slate-900` with solid borders (`border border-slate-700` or `border-slate-800`).
  - Text: `text-slate-200`, `text-slate-300` for secondary.
- **Accent Colors:** 
  - Primary Action/Highlight/Positive: Can use bright contrasting colors like White (`bg-white text-slate-900`), Emerald (`text-emerald-500`), or vibrant PostHog-style colors to stand out against the dark background.
  - Negative/Arrears/Danger: `text-rose-500`
  - Secondary Info: `text-slate-400`
- **Currency Formatting:** ALWAYS format THB amounts in the UI using the `formatThB` pattern:
  ```tsx
  const formatThB = (num: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
  ```
- **Type Safety:** The project uses TypeScript. Ensure all API responses have typed structures. Do not blindly `as any` unless absolutely necessary.
