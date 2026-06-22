import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">🏢 ระบบจัดการหอพัก</h1>
          <p className="text-slate-500">เลือกเมนูที่ต้องการเพื่อเข้าสู่ระบบงาน</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/invoices" 
            className="p-6 rounded-xl border-2 border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 transition flex flex-col justify-between group"
          >
            <div>
              <span className="text-3xl mb-3 block">📄</span>
              <h2 className="text-xl font-semibold text-blue-900 mb-1 group-hover:translate-x-1 transition-transform">ออกใบแจ้งหนี้ / ใบเสร็จ &rarr;</h2>
              <p className="text-sm text-blue-600/80">คำนวณค่าน้ำ-ค่าไฟ, ออกไฟล์ PDF และส่ง Line Notify</p>
            </div>
          </Link>

          <Link 
            href="/settings" 
            className="p-6 rounded-xl border-2 border-purple-100 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300 transition flex flex-col justify-between group"
          >
            <div>
              <span className="text-3xl mb-3 block">⚙️</span>
              <h2 className="text-xl font-semibold text-purple-900 mb-1 group-hover:translate-x-1 transition-transform">ตั้งค่าระบบ &rarr;</h2>
              <p className="text-sm text-purple-600/80">ปรับเปลี่ยนราคาค่าไฟ (ต่อยูนิต) และค่าน้ำรายเดือน</p>
            </div>
          </Link>
        </div>

        <div className="mt-8 text-center border-t pt-4 text-xs text-slate-400">
          Dormitory Management System v1.0 (MVP) • Powered by Next.js & Google Sheets API
        </div>

      </div>
    </div>
  );
}