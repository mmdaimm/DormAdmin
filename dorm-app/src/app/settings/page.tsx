'use client';

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rates {
  electricRate: number;
  waterRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  accent: string; // tailwind color class for the icon bg
}) {
  return (
    <div className="flex items-center gap-4 bg-slate-800 rounded-2xl p-5 border border-slate-700">
      <div className={`w-12 h-12 flex items-center justify-center rounded-xl shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">
          {value.toLocaleString('th-TH')}
          <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── Fetched / displayed rates ─────────────────────────────────────────────
  const [currentRates, setCurrentRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // ── Form fields ───────────────────────────────────────────────────────────
  const [elecInput, setElecInput] = useState('');
  const [waterInput, setWaterInput] = useState('');

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const r: Rates = data.rates;
        setCurrentRates(r);
        setElecInput(String(r.electricRate));
        setWaterInput(String(r.waterRate));
      } catch {
        setFetchError('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อกับ Google Sheets');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    const elec = parseFloat(elecInput);
    const water = parseFloat(waterInput);

    if (isNaN(elec) || elec <= 0) {
      setSaveError('ค่าไฟต้องเป็นตัวเลขที่มากกว่าศูนย์');
      return;
    }
    if (isNaN(water) || water < 0) {
      setSaveError('ค่าน้ำต้องเป็นตัวเลขที่ไม่ติดลบ');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electricRate: elec, waterRate: water }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setCurrentRates({ electricRate: elec, waterRate: water });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ── Detect unsaved changes ─────────────────────────────────────────────────
  const hasChanges =
    currentRates !== null &&
    (parseFloat(elecInput) !== currentRates.electricRate ||
      parseFloat(waterInput) !== currentRates.waterRate);

  // ─── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดการตั้งค่า…</p>
        </div>
      </div>
    );
  }

  // ─── Render: main ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            ตั้งค่าอัตราค่าบริการ
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            การเปลี่ยนค่าที่นี่จะมีผลกับการคำนวณทุกใบแจ้งหนี้ที่ออกใหม่
          </p>
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div className="mb-6 bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
            ⚠️ {fetchError}
          </div>
        )}

        {/* ── Current rates display cards ──────────────────────────────────── */}
        {currentRates && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <StatCard
              icon={
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              label="ค่าไฟปัจจุบัน"
              value={currentRates.electricRate}
              unit="บาท / หน่วย"
              accent="bg-amber-500/20 border border-amber-500/30"
            />
            <StatCard
              icon={
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707" />
                  <circle cx="12" cy="12" r="4" strokeWidth={2} />
                </svg>
              }
              label="ค่าน้ำปัจจุบัน"
              value={currentRates.waterRate}
              unit="บาท / เดือน"
              accent="bg-blue-500/20 border border-blue-500/30"
            />
          </div>
        )}

        {/* ── Edit form ─────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSave}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            แก้ไขอัตราค่าบริการ
          </h2>

          {/* Electric rate */}
          <div>
            <label
              htmlFor="electricRate"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              ค่าไฟฟ้าต่อหน่วย (THB / Unit)
              <span className="text-red-400 ml-1">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold select-none">
                ⚡
              </span>
              <input
                id="electricRate"
                type="number"
                min="0.01"
                step="0.01"
                value={elecInput}
                onChange={(e) => { setElecInput(e.target.value); setSaveError(''); setSaveSuccess(false); }}
                required
                placeholder="5.00"
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl pl-10 pr-16 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-slate-600"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                ฿/หน่วย
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              ค่าเริ่มต้น: 5 บาท/หน่วย (ตาม dorm.ts)
            </p>
          </div>

          {/* Water rate */}
          <div>
            <label
              htmlFor="waterRate"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              ค่าน้ำเหมาจ่ายต่อเดือน (THB / Month)
              <span className="text-red-400 ml-1">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold select-none">
                💧
              </span>
              <input
                id="waterRate"
                type="number"
                min="0"
                step="0.01"
                value={waterInput}
                onChange={(e) => { setWaterInput(e.target.value); setSaveError(''); setSaveSuccess(false); }}
                required
                placeholder="80.00"
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl pl-10 pr-16 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-slate-600"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                ฿/เดือน
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              ค่าเริ่มต้น: 80 บาท/เดือน (ตาม dorm.ts)
            </p>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
              ⚠️ {saveError}
            </div>
          )}

          {/* Success banner */}
          {saveSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-700 rounded-xl px-4 py-3 text-emerald-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              บันทึกอัตราค่าบริการสำเร็จแล้ว!
            </div>
          )}

          {/* Unsaved changes indicator */}
          {hasChanges && !saveSuccess && (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (currentRates) {
                  setElecInput(String(currentRates.electricRate));
                  setWaterInput(String(currentRates.waterRate));
                }
                setSaveError('');
                setSaveSuccess(false);
              }}
              disabled={!hasChanges || saving}
              className="flex-1 py-2.5 px-5 rounded-xl border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={saving || !hasChanges}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-indigo-900/40 disabled:shadow-none disabled:cursor-not-allowed text-sm"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังบันทึก…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  บันทึกการตั้งค่า
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info note */}
        <p className="text-center text-xs text-slate-700 mt-6">
          ข้อมูลจัดเก็บใน Google Sheets • sheet: Settings • key: electric_rate / water_rate
        </p>
      </div>
    </div>
  );
}
