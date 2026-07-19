import type { Metadata } from 'next';
import DashboardKPI from '@/components/DashboardKPI';

export const metadata: Metadata = {
  title: 'DormAdmin | แดชบอร์ด',
  description: 'สรุปภาพรวมและสถิติหอพัก',
};

export default function DashboardPage() {
  return (
    <div className="w-full flex flex-col gap-6">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ภาพรวมระบบ (Dashboard)</h1>
        <p className="text-slate-500 mt-2">ยินดีต้อนรับเข้าสู่ระบบจัดการหอพัก ดูภาพรวมและสถิติรายได้ที่นี่</p>
      </header>

      <section className="w-full">
        <DashboardKPI />
      </section>
    </div>
  );
}