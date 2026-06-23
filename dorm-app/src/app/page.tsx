import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DormAdmin | เมนูหลัก',
  description: 'ระบบจัดการหอพัก — เลือกฟังก์ชันที่ต้องการใช้งาน',
};

// ─── Static navigation cards ─────────────────────────────────────────────────
// This page renders NO dynamic data and makes ZERO API calls.
// It is a pure static portal hub that links to functional sub-pages.

const NAV_CARDS = [
  {
    href: '/invoices',
    emoji: '📄',
    titleTH: 'ออกใบแจ้งหนี้ / ใบเสร็จ',
    titleEN: 'Invoice & Receipt',
    description: 'คำนวณค่าเช่า ค่าไฟ ค่าน้ำ บันทึกข้อมูล และดาวน์โหลด PDF',
    accent: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60',
    iconBg: 'bg-indigo-500/20',
    badgeColor: 'text-indigo-400',
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
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* ── Hero Header ── */}
      <header className="pt-16 pb-10 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-6">
          <span className="text-3xl">🏠</span>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          DormAdmin
        </h1>
        <p className="text-slate-400 text-base max-w-sm mx-auto">
          ระบบจัดการหอพัก — เลือกฟังก์ชันที่ต้องการใช้งาน
        </p>
      </header>

      {/* ── Navigation Cards ── */}
      <main className="flex-1 px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`
                group relative flex flex-col gap-4 p-6 rounded-2xl
                bg-gradient-to-br ${card.accent}
                border transition-all duration-200
                hover:shadow-xl hover:-translate-y-0.5
                min-h-[176px]
              `}
            >
              {/* Icon */}
              <div className={`
                w-14 h-14 flex items-center justify-center rounded-xl
                ${card.iconBg} shrink-0 text-3xl
                transition-transform duration-200 group-hover:scale-110
              `}>
                {card.emoji}
              </div>

              {/* Text */}
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

              {/* Arrow */}
              <div className="absolute top-5 right-5 text-slate-600 group-hover:text-slate-400 transition-colors">
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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