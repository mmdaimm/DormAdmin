'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Invoice } from '@/types';
import type { Rates } from '@/services/sheetService';

// ── PDF layer: fully quarantined from SSR ────────────────────────────────────
// PdfDownloadButtons imports @react-pdf/renderer internally. By wrapping it
// with { ssr: false } here, Turbopack's server-side compiler never evaluates
// the library, which eliminates the "ModuleId not found for ident:
// [externals]/@react-pdf/renderer" build error.
const SafePdfButtons = dynamic(
  () => import('@/components/pdf/PdfDownloadButtons'),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-slate-500">⏳ กำลังโหลดระบบพิมพ์เอกสาร...</p>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomWithMeta {
  roomId: string;
  roomNumber: string;
  monthlyRent: number;
  lineToken: string;
  prevMeter: number;
  lastStatus: string | null;
}

interface SubmitResult {
  invoice: Invoice;
  roomNumber: string;
  electricRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const thb = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentPeriod = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  // ── Server data ──────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<RoomWithMeta[]>([]);
  const [rates, setRates] = useState<Rates>({ electricRate: 5, waterRate: 80 });
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');

  // ── Form state ───────────────────────────────────────────────────────────────
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [currMeter, setCurrMeter] = useState('');
  const [otherBill, setOtherBill] = useState('0');

  // ── Submission state ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);

  // ── Fetch rooms + rates on mount ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [roomsRes, ratesRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/settings'),
        ]);

        if (!roomsRes.ok) throw new Error(`โหลดข้อมูลห้องล้มเหลว (${roomsRes.status})`);
        if (!ratesRes.ok) throw new Error(`โหลดอัตราค่าบริการล้มเหลว (${ratesRes.status})`);

        const roomsData = await roomsRes.json();
        const ratesData = await ratesRes.json();

        if (roomsData.success) setRooms(roomsData.rooms);
        if (ratesData.success) setRates(ratesData.rates);
      } catch {
        setDataError('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  // ── Derived selected room ────────────────────────────────────────────────────
  const selectedRoom = useMemo(
    () => rooms.find((r) => r.roomId === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // ── Live calculation ─────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!selectedRoom) return null;
    const curr = parseFloat(currMeter) || 0;
    const other = parseFloat(otherBill) || 0;
    const units = Math.max(0, curr - selectedRoom.prevMeter);
    const elec = units * rates.electricRate;
    const water = rates.waterRate;

    const total = selectedRoom.monthlyRent + elec + water + other;
    return { units, elec, water, other, total };
  }, [selectedRoom, currMeter, otherBill, rates]);

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    const curr = parseFloat(currMeter);
    if (isNaN(curr) || curr < selectedRoom.prevMeter) {
      setSubmitError(
        `มิเตอร์ปัจจุบันต้องมากกว่าหรือเท่ากับมิเตอร์ครั้งก่อน (${selectedRoom.prevMeter})`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoom.roomId,
          roomNumber: selectedRoom.roomNumber,
          period,
          currMeter: curr,
          otherBill: parseFloat(otherBill) || 0,
          lineToken: selectedRoom.lineToken,
        }),
      });

      if (!res.ok && res.status !== 409) {
        // Non-JSON responses (e.g. 502 HTML gateway errors)
        setSubmitError(`เกิดข้อผิดพลาด (HTTP ${res.status}: ${res.statusText || 'Server Error'})`);
        return;
      }

      const data = await res.json();

      if (!data.success) {
        setSubmitError(data.error ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
        return;
      }

      setResult({
        invoice: data.invoice as Invoice,
        roomNumber: selectedRoom.roomNumber,
        electricRate: rates.electricRate,
      });
    } catch {
      setSubmitError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render: loading ─────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดข้อมูลห้องพัก…</p>
        </div>
      </div>
    );
  }

  // ─── Render: data error ───────────────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-950/60 border border-red-700 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">⚠️ ไม่สามารถโหลดข้อมูลได้</p>
          <p className="text-red-300 text-sm">{dataError}</p>
        </div>
      </div>
    );
  }

  // ─── Render: success — show download buttons ──────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Success card */}
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/40">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white text-center mb-1">
              บันทึกสำเร็จแล้ว!
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              ห้อง {result.roomNumber} • ประจำเดือน {result.invoice.period}
            </p>

            {/* Summary mini-table */}
            <div className="bg-slate-800 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>เลขที่ใบแจ้งหนี้</span>
                <span className="text-white font-mono text-xs">{result.invoice.invoiceId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ยอดรวมทั้งสิ้น</span>
                <span className="text-indigo-300 font-bold text-base">฿ {thb(result.invoice.totalAmount)}</span>
              </div>
              {result.invoice.arrears > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>รวมยอดค้างชำระ</span>
                  <span>฿ {thb(result.invoice.arrears)}</span>
                </div>
              )}
            </div>

            {/* Download buttons — rendered entirely client-side via SafePdfButtons */}
            <SafePdfButtons
              invoice={result.invoice}
              roomNumber={result.roomNumber}
              electricRate={result.electricRate}
            />

            <button
              onClick={() => {
                setResult(null);
                setSelectedRoomId('');
                setCurrMeter('');
                setOtherBill('0');
              }}
              className="text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
            >
              ← ออกบิลห้องถัดไป
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: main form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            ออกใบแจ้งหนี้
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            อัตราค่าไฟ: <span className="text-indigo-400 font-semibold">{rates.electricRate} ฿/หน่วย</span>
            &nbsp;•&nbsp;
            ค่าน้ำ: <span className="text-indigo-400 font-semibold">{rates.waterRate} ฿/เดือน</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── LEFT: Form ─────────────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl"
          >
            {/* Room selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                เลือกห้องพัก <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  setCurrMeter('');
                  setSubmitError('');
                }}
                required
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                <option value="">— กรุณาเลือกห้อง —</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>
                    ห้อง {r.roomNumber} — ค่าเช่า {thb(r.monthlyRent)} ฿
                  </option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                ประจำเดือน <span className="text-red-400">*</span>
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {/* Meter readings — shown only when room selected */}
            {selectedRoom && (
              <div className="grid grid-cols-2 gap-4">
                {/* Previous meter (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    มิเตอร์ครั้งก่อน (หน่วย)
                  </label>
                  <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-400 rounded-xl px-4 py-2.5 cursor-not-allowed select-none">
                    {selectedRoom.prevMeter.toLocaleString()}
                  </div>
                </div>

                {/* Current meter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    มิเตอร์ปัจจุบัน (หน่วย) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={selectedRoom.prevMeter}
                    step="0.01"
                    value={currMeter}
                    onChange={(e) => { setCurrMeter(e.target.value); setSubmitError(''); }}
                    placeholder={String(selectedRoom.prevMeter)}
                    required
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Other bill */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                ค่าใช้จ่ายอื่น ๆ (บาท)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherBill}
                onChange={(e) => setOtherBill(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-slate-600"
              />
            </div>

            {/* Error message */}
            {submitError && (
              <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
                ⚠️ {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !selectedRoomId || !currMeter}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-900/40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังบันทึก…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  บันทึกและส่ง Line Notify
                </>
              )}
            </button>
          </form>

          {/* ── RIGHT: Live calculation preview ────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl sticky top-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
                ตัวอย่างยอดชำระ
              </h3>

              {!selectedRoom || !calc ? (
                <p className="text-slate-600 text-sm text-center py-8">
                  เลือกห้องและกรอกมิเตอร์<br />เพื่อดูยอดรวม
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Line items */}
                  {[
                    { label: 'ค่าเช่าห้อง', value: selectedRoom.monthlyRent, color: 'text-slate-200' },
                    {
                      label: `ค่าไฟ (${calc.units} หน่วย × ${rates.electricRate} ฿)`,
                      value: calc.elec,
                      color: 'text-amber-300',
                    },
                    { label: 'ค่าน้ำ (เหมาจ่าย)', value: calc.water, color: 'text-blue-300' },
                    ...(calc.other > 0
                      ? [{ label: 'ค่าใช้จ่ายอื่น ๆ', value: calc.other, color: 'text-slate-300' }]
                      : []),
                    ...(selectedRoom.lastStatus === 'UNPAID'
                      ? [{ label: 'มีค้างชำระ (server คำนวณ)', value: 0, color: 'text-red-400' }]
                      : []),
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 leading-snug">{item.label}</span>
                      <span className={`font-semibold tabular-nums ${item.color}`}>
                        {item.value === 0 && item.label.includes('ค้าง') ? '—' : `฿ ${thb(item.value)}`}
                      </span>
                    </div>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-slate-700 pt-3 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 font-medium">รวมทั้งสิ้น</span>
                      <span className="text-indigo-300 font-bold text-xl tabular-nums">
                        ฿ {thb(calc.total)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      * ยอดค้างชำระเดือนก่อนจะถูกรวมโดย server
                    </p>
                  </div>

                  {/* Arrears warning badge */}
                  {selectedRoom.lastStatus === 'UNPAID' && (
                    <div className="mt-2 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-300">
                      ⚠️ ห้องนี้มียอดค้างจากเดือนก่อน
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
