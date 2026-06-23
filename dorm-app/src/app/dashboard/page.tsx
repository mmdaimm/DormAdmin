'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/types';

// ─── Local types (mirrors API response shape) ─────────────────────────────────

interface KpiData {
  totalRooms: number;
  occupiedRooms: number;
  unpaidCount: number;
  totalOutstanding: number;
}

interface EnrichedInvoice extends Invoice {
  roomNumber: string;
  tenantName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const thb = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type StatusFilter = 'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

const STATUS_LABEL: Record<Invoice['status'], string> = {
  PAID: 'ชำระแล้ว',
  UNPAID: 'ยังไม่ชำระ',
  PARTIALLY_PAID: 'ชำระบางส่วน',
};

const STATUS_STYLE: Record<Invoice['status'], string> = {
  PAID: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  UNPAID: 'bg-red-500/15 text-red-400 border border-red-500/30',
  PARTIALLY_PAID: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  emoji: string;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}

function KpiCard({ emoji, label, value, sub, accent }: KpiCardProps) {
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 flex flex-col gap-3 ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-2xl">{emoji}</span>
      </div>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // ── Data state ───────────────────────────────────────────────────────────────
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // ── Payment state ────────────────────────────────────────────────────────────
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [payError, setPayError] = useState('');

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setDataError('');
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`โหลดข้อมูลล้มเหลว (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
      setKpi(data.kpi);
      setInvoices(data.invoices);
    } catch (err: unknown) {
      setDataError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Optimistic pay with rollback ─────────────────────────────────────────────
  const handlePay = async (invoice: EnrichedInvoice) => {
    const { invoiceId, totalAmount, paidAmount } = invoice;
    const outstanding = Math.max(0, totalAmount - paidAmount);

    // Optimistic update: mark paid immediately in local state
    setPayingIds((prev) => new Set(prev).add(invoiceId));
    setPayError('');
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceId === invoiceId ? { ...inv, status: 'PAID' } : inv
      )
    );
    setKpi((prev) =>
      prev
        ? {
            ...prev,
            unpaidCount: Math.max(0, prev.unpaidCount - 1),
            totalOutstanding: Math.max(0, prev.totalOutstanding - outstanding),
          }
        : prev
    );

    try {
      const res = await fetch('/api/invoices/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `เกิดข้อผิดพลาด (HTTP ${res.status})`);
      }
    } catch (err: unknown) {
      // ── Rollback on failure ──────────────────────────────────────────────────
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.invoiceId === invoiceId ? { ...inv, status: 'UNPAID' } : inv
        )
      );
      setKpi((prev) =>
        prev
          ? {
              ...prev,
              unpaidCount: prev.unpaidCount + 1,
              totalOutstanding: prev.totalOutstanding + outstanding,
            }
          : prev
      );
      setPayError(
        err instanceof Error ? err.message : 'บันทึกการชำระเงินไม่สำเร็จ กรุณาลองใหม่'
      );
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(invoiceId);
        return next;
      });
    }
  };

  // ── Filtered invoices ─────────────────────────────────────────────────────────
  const filtered = invoices.filter((inv) =>
    filter === 'ALL' ? true : inv.status === filter
  );

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดข้อมูล Dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Render: data error ────────────────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-red-800/60 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <p className="text-red-400 text-lg font-semibold mb-2">⚠️ เกิดข้อผิดพลาด</p>
          <p className="text-red-300 text-sm mb-6">{dataError}</p>
          <button
            onClick={load}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors mb-3"
          >
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← กลับหน้าเมนูหลัก
          </Link>
        </div>
      </div>
    );
  }

  // ── Render: main ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back navigation */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                       text-sm font-medium text-slate-500 hover:text-slate-300
                       hover:bg-slate-800 transition-colors"
          >
            ← กลับหน้าเมนูหลัก
          </Link>
        </div>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">แดชบอร์ด</h1>
          <p className="text-slate-400 mt-1 text-sm">ภาพรวมการเงินและประวัติการรับชำระเงิน</p>
        </div>

        {/* Pay error alert */}
        {payError && (
          <div className="mb-6 bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-red-300 text-sm">⚠️ {payError}</p>
            <button
              onClick={() => setPayError('')}
              className="text-red-500 hover:text-red-300 text-lg font-bold leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* ── KPI Cards (2×2 grid) ── */}
        {kpi && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              emoji="🏠"
              label="ห้องทั้งหมด"
              value={kpi.totalRooms}
              sub="ห้องในระบบ"
              accent="border-slate-700"
            />
            <KpiCard
              emoji="👥"
              label="ห้องที่มีผู้เช่า"
              value={kpi.occupiedRooms}
              sub={`ว่าง ${kpi.totalRooms - kpi.occupiedRooms} ห้อง`}
              accent="border-emerald-700/40"
            />
            <KpiCard
              emoji="⚠️"
              label="ยังไม่ชำระ"
              value={kpi.unpaidCount}
              sub="ใบแจ้งหนี้ที่ค้างอยู่"
              accent="border-red-700/40"
            />
            <KpiCard
              emoji="💰"
              label="ยอดค้างชำระรวม"
              value={`฿ ${thb(kpi.totalOutstanding)}`}
              sub="ผลรวมทุกใบที่ยังไม่ชำระ"
              accent="border-amber-700/40"
            />
          </div>
        )}

        {/* ── Payment History Table ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <h2 className="text-base font-semibold text-white">ประวัติใบแจ้งหนี้</h2>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1 flex-wrap">
              {(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'ทั้งหมด' :
                   f === 'UNPAID' ? 'ยังไม่ชำระ' :
                   f === 'PARTIALLY_PAID' ? 'บางส่วน' : 'ชำระแล้ว'}
                </button>
              ))}
            </div>
          </div>

          {/* Table scroll wrapper */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-12">ไม่มีรายการที่ตรงกับตัวกรองที่เลือก</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">ห้อง</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">ผู้เช่า</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">ประจำเดือน</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">ยอดรวม</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">สถานะ</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map((inv) => {
                    const isPaying = payingIds.has(inv.invoiceId);
                    const canPay = inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID';
                    return (
                      <tr key={inv.invoiceId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                          ห้อง {inv.roomNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {inv.tenantName}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                          {inv.period}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-indigo-300 tabular-nums whitespace-nowrap">
                          ฿ {thb(inv.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {canPay ? (
                            <button
                              onClick={() => handlePay(inv)}
                              disabled={isPaying}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                         bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700
                                         disabled:text-slate-500 text-white font-semibold text-xs
                                         transition-all duration-200 disabled:cursor-not-allowed"
                            >
                              {isPaying ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  กำลังบันทึก…
                                </>
                              ) : (
                                <>💰 กดรับชำระเงิน</>
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table footer */}
          {filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/30">
              <p className="text-xs text-slate-600">แสดง {filtered.length} รายการ</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
