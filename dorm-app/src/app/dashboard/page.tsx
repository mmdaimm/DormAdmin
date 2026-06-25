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

type StatusFilter = 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID';

const STATUS_LABEL: Record<Invoice['status'], string> = {
  PAID: 'ชำระแล้ว',
  UNPAID: 'ยังไม่ชำระ',
  PARTIAL: 'ชำระบางส่วน',        // 👈 เติมของใหม่เข้าไปตรงนี้!
}

const STATUS_STYLE: Record<Invoice['status'], string> = {
  PAID: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  UNPAID: 'bg-red-500/15 text-red-400 border border-red-500/30',
  PARTIAL: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
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
  
  // ── Payment Modal state ──────────────────────────────────────────────────────
  const [selectedInvoice, setSelectedInvoice] = useState<EnrichedInvoice | null>(null);
  const [amountPaidStr, setAmountPaidStr] = useState<string>('');

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

  useEffect(() => {
    // eslint-disable-next-line
    void load();
  }, [load]);

  // ── Pay action ───────────────────────────────────────────────────────────────
  const openPaymentModal = (inv: EnrichedInvoice) => {
    setSelectedInvoice(inv);
    const billedTotal = (inv.totalAmount || 0) + (inv.remainingArrears || 0) - (inv.creditApplied || 0);
    const safeRemaining = Math.max(0, billedTotal - (inv.paidAmount || 0));
    setAmountPaidStr(safeRemaining.toString());
  };

  const handlePay = async (invoiceId: string, amountPaid: number) => {
    setPayingIds((prev) => new Set(prev).add(invoiceId));
    setPayError('');

    try {
      const res = await fetch('/api/invoices/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amountPaid }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `เกิดข้อผิดพลาด (HTTP ${res.status})`);
      }
      
      // Reload to get exact updated state (credits, arrears, status) from backend
      await load();
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'บันทึกการชำระเงินไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(invoiceId);
        return next;
      });
    }
  };

  // ── Payment Modal UI ──────────────────────────────────────────────────────────
  const renderPaymentModal = () => {
    if (!selectedInvoice) return null;
    
    const amountPaid = parseFloat(amountPaidStr) || 0;
    const billedTotal = (selectedInvoice.totalAmount || 0) + (selectedInvoice.remainingArrears || 0) - (selectedInvoice.creditApplied || 0);
    const safeRemaining = Math.max(0, billedTotal - (selectedInvoice.paidAmount || 0));
    const grandTotal = safeRemaining;
    const isOverpaid = amountPaid > grandTotal;
    const isInvalid = amountPaid <= 0;
    const overpaymentAmount = amountPaid - grandTotal;

    const handleConfirm = async () => {
      if (isInvalid) return;
      const invId = selectedInvoice.invoiceId;
      setSelectedInvoice(null);
      await handlePay(invId, amountPaid);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-4">รับชำระเงิน</h3>
          <p className="text-slate-300 text-sm mb-4">
            ห้อง {selectedInvoice.roomNumber} ({selectedInvoice.tenantName})<br />
            ประจำเดือน: {selectedInvoice.period}
          </p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-1">ยอดรวมสุทธิ</label>
            <div className="text-2xl font-bold text-indigo-400">฿ {thb(grandTotal)}</div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-1">ยอดชำระ (บาท)</label>
            <input
              type="number"
              value={amountPaidStr}
              onChange={(e) => setAmountPaidStr(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {isOverpaid && (
              <p className="mt-2 text-sm text-emerald-400 font-medium">
                ยอดชำระเกิน: ระบบจะบันทึกเงิน {overpaymentAmount} บาท เป็นเครดิตสะสมสำหรับเดือนถัดไป
              </p>
            )}
            {isInvalid && (
              <p className="mt-2 text-sm text-red-400 font-medium">
                กรุณากรอกยอดชำระที่มากกว่า 0 บาท
              </p>
            )}
          </div>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              disabled={isInvalid}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors"
            >
              ยืนยันการชำระเงิน
            </button>
          </div>
        </div>
      </div>
    );
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
              {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as StatusFilter[]).map((f) => (
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
                   f === 'PARTIAL' ? 'บางส่วน' : 'ชำระแล้ว'}
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
                    const canPay = inv.status === 'UNPAID' || inv.status === 'PARTIAL';
                    const remainingArrears = inv.remainingArrears || 0;
                    
                    const billedTotal = (inv.totalAmount || 0) + remainingArrears - (inv.creditApplied || 0);
                    const safeRemaining = Math.max(0, billedTotal - (inv.paidAmount || 0));
                    
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
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="font-semibold text-indigo-300 tabular-nums">
                            ฿ {thb(billedTotal)}
                          </div>
                          {inv.status === 'PAID' && (
                            <div className="text-[10px] text-emerald-400 mt-0.5">
                              (ชำระครบถ้วน)
                            </div>
                          )}
                          {inv.status === 'PARTIAL' && (
                            <div className="text-[10px] text-amber-500 mt-0.5">
                              (ชำระแล้ว ฿{thb(inv.paidAmount || 0)} / ค้างชำระ ฿{thb(safeRemaining)})
                            </div>
                          )}
                          {inv.status === 'UNPAID' && remainingArrears > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              (รวมค้างชำระเก่า ฿{thb(remainingArrears)})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {canPay ? (
                            <button
                              onClick={() => openPaymentModal(inv)}
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

        {renderPaymentModal()}
      </div>
    </div>
  );
}
