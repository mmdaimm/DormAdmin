'use client';

/**
 * Next.js App Router error boundary for /invoices.
 *
 * Catches unhandled errors thrown during rendering or data fetching
 * in the /invoices segment and displays a recovery UI.
 */
export default function InvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Error card */}
        <div className="bg-slate-900 border border-red-800/60 rounded-2xl p-8 shadow-xl">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center border border-red-500/30">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white text-center mb-2">
            เกิดข้อผิดพลาด
          </h2>
          <p className="text-sm text-red-300 text-center bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 mb-6">
            {error.message || 'ไม่สามารถโหลดหน้าออกใบแจ้งหนี้ได้'}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl
                         bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                         transition-all duration-200 shadow-lg shadow-indigo-900/40 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              ลองใหม่อีกครั้ง
            </button>

            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-3 py-2
                         rounded-lg text-sm font-medium text-slate-500
                         hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              ← กลับหน้าเมนูหลัก
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
