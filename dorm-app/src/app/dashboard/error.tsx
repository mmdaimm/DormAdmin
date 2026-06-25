'use client';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center">
      <h2 className="text-xl font-bold text-red-500 mb-4">พบข้อผิดพลาดในการโหลดข้อมูล</h2>
      <p className="text-slate-400 mb-6">{error.message}</p>
      <button onClick={() => reset()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
