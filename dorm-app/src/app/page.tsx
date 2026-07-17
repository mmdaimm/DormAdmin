import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';
import DashboardKPI from '@/components/DashboardKPI';

export const metadata: Metadata = {
  title: 'DormAdmin | เมนูหลัก',
  description: 'ระบบจัดการหอพัก — เลือกฟังก์ชันที่ต้องการใช้งาน',
};

// ─── Static navigation cards ────────────────────────────────────────────────
const NAV_CARDS = [
  {
    href: '/invoices',
    emoji: '📄',
    titleTH: 'ออกบิล / ใบเสร็จ',
    titleEN: 'Invoice & Receipt',
    description: 'คำนวณค่าเช่า ค่าไฟ ค่าน้ำ บันทึกข้อมูล และดาวน์โหลด PDF',
    accent: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60',
    iconBg: 'bg-indigo-500/20',
    badgeColor: 'text-indigo-400',
    glow: 'hover:shadow-indigo-900/30',
    roles: ['admin', 'owner'],
  },
  {
    href: '/dashboard',
    emoji: '📊',
    titleTH: 'แดชบอร์ด & ประวัติรับเงิน',
    titleEN: 'Dashboard & Payments',
    description: 'ดูภาพรวมการเงิน ยอดค้างชำระ และบันทึกการรับชำระเงิน',
    accent: 'from-cyan-500/20 to-blue-600/10 border-cyan-500/30 hover:border-cyan-400/60',
    iconBg: 'bg-cyan-500/20',
    badgeColor: 'text-cyan-400',
    glow: 'hover:shadow-cyan-900/30',
    roles: ['admin', 'owner'],
  },
  {
    href: '/tenants',
    emoji: '👥',
    titleTH: 'จัดการข้อมูลผู้เช่า',
    titleEN: 'Tenant Management',
    description: 'ดูและแก้ไขข้อมูลผู้เช่าแต่ละห้อง เพิ่มผู้เช่าใหม่หรืออัพเดตสถานะ',
    accent: 'from-violet-500/20 to-purple-600/10 border-violet-500/30 hover:border-violet-400/60',
    iconBg: 'bg-violet-500/20',
    badgeColor: 'text-violet-400',
    glow: 'hover:shadow-violet-900/30',
    roles: ['owner'],
  },
  {
    href: '/invoice-manager',
    emoji: '📋',
    titleTH: 'จัดการบิล',
    titleEN: 'Invoice Manager',
    description: 'ดูรายการบิลทั้งหมด และสามารถแก้ไขสถานะการชำระเงินย้อนหลังได้',
    accent: 'from-fuchsia-500/20 to-pink-600/10 border-fuchsia-500/30 hover:border-fuchsia-400/60',
    iconBg: 'bg-fuchsia-500/20',
    badgeColor: 'text-fuchsia-400',
    glow: 'hover:shadow-fuchsia-900/30',
    roles: ['owner', 'admin'],
  },
  {
    href: '/settings',
    emoji: '⚙️',
    titleTH: 'ตั้งค่าระบบ',
    titleEN: 'System Settings',
    description: 'กำหนดอัตราค่าไฟและค่าน้ำที่ใช้ในการคำนวณใบแจ้งหนี้',
    accent: 'from-slate-700/40 to-slate-800/20 border-slate-600/40 hover:border-slate-500/70',
    iconBg: 'bg-slate-600/30',
    badgeColor: 'text-slate-400',
    glow: 'hover:shadow-slate-900/30',
    roles: ['owner'],
  },
  {
    href: '/accounting',
    emoji: '📈',
    titleTH: 'ระบบบัญชี',
    titleEN: 'Accounting',
    description: 'ดูภาพรวมรายได้ รายจ่าย กำไร และเพิ่มรายการค่าใช้จ่ายต่างๆ',
    accent: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30 hover:border-emerald-400/60',
    iconBg: 'bg-emerald-500/20',
    badgeColor: 'text-emerald-400',
    glow: 'hover:shadow-emerald-900/30',
    roles: ['owner'],
  },
] as const;

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const session = await decrypt(token);
  const userRole = session?.role || 'admin';
  const username = session?.username || 'User';

  const visibleCards = NAV_CARDS.filter(card => (card.roles as readonly string[]).includes(userRole));

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* ── Top Bar ── */}
      <div className="w-full flex justify-between items-center px-6 py-4 border-b border-slate-800">
        <div className="text-slate-400 text-sm">
          เข้าสู่ระบบในชื่อ: <span className="text-white font-medium">{username}</span> 
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-xs uppercase tracking-wider">{userRole}</span>
        </div>
        <LogoutButton />
      </div>

      <header className="pt-12 pb-6 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                        bg-indigo-600/20 border border-indigo-500/30 mb-6">
          <span className="text-3xl">🏠</span>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          DormAdmin
        </h1>
        <p className="text-slate-400 text-base max-w-sm mx-auto">
          ระบบจัดการหอพัก — เลือกฟังก์ชันที่ต้องการใช้งาน
        </p>
      </header>

      {/* ── KPI Dashboard ── */}
      <section className="px-4 max-w-4xl mx-auto w-full">
        <DashboardKPI />
      </section>

      {/* ── Navigation Grid ── */}
      <main className="flex-1 px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`
                group relative flex flex-col gap-4 p-6 rounded-2xl
                bg-gradient-to-br ${card.accent}
                border transition-all duration-200
                hover:shadow-xl hover:-translate-y-0.5 ${card.glow}
                min-h-[176px]
              `}
            >
              <div className={`
                w-14 h-14 flex items-center justify-center rounded-xl
                ${card.iconBg} shrink-0 text-3xl
                transition-transform duration-200 group-hover:scale-110
              `}>
                {card.emoji}
              </div>

              <div className="flex-1">
                <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${card.badgeColor}`}>
                  {card.titleEN}
                </p>
                <h2 className="text-xl font-bold text-white leading-snug mb-2">
                  {card.titleTH}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="absolute top-5 right-5 text-slate-600 group-hover:text-slate-400 transition-colors">
                <svg
                  className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-8 text-center">
        <p className="text-xs text-slate-700">
          DormAdmin • ข้อมูลจัดเก็บใน Google Sheets
        </p>
      </footer>

    </div>
  );
}