'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Rates } from '@/services/sheetService';
import type { Room } from '@/types';

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
  accent: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-slate-900 rounded-2xl p-5 border-2 border-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
      <div className={`w-12 h-12 flex items-center justify-center rounded-xl shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">
          {value.toLocaleString('th-TH')}
          <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function RoomSettingCard({ room, onSave }: { room: Room, onSave: (r: string, rent: number, dep: number) => Promise<void> }) {
  const [rent, setRent] = useState(String(room.monthlyRent || 0));
  const [deposit, setDeposit] = useState(String(room.depositAmount || 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const hasChanges = parseFloat(rent) !== (room.monthlyRent || 0) || parseFloat(deposit) !== (room.depositAmount || 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const r = parseFloat(rent);
    const d = parseFloat(deposit);
    if (isNaN(r) || r < 0) return setError('ค่าเช่าต้องไม่ติดลบ');
    if (isNaN(d) || d < 0) return setError('ค่ามัดจำต้องไม่ติดลบ');
    setSaving(true);
    try {
      await onSave(room.roomId, r, d);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)] relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-950 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-bl-full" />
      
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 relative z-10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" />
            </svg>
          </div>
          ห้อง {room.roomNumber}
        </h3>
        {success && <span className="text-emerald-400 text-xs font-medium px-2 py-1 bg-emerald-950 border border-emerald-900 rounded-full flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> สำเร็จ</span>}
      </div>
      {error && <p className="text-red-400 text-xs px-3 py-2 bg-red-950/50 border border-red-900 rounded-lg">{error}</p>}
      
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">ค่าเช่า (บาท/เดือน)</label>
          <div className="relative group/input">
            <input type="number" min="0" step="0.01" value={rent} onChange={e => setRent(e.target.value)}
                   className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 outline-none transition-all shadow-[2px_2px_0_0_rgba(51,65,85,1)]" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium group-focus-within/input:text-emerald-500 transition-colors">฿</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">ค่ามัดจำ (บาท)</label>
          <div className="relative group/input">
            <input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)}
                   className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 outline-none transition-all shadow-[2px_2px_0_0_rgba(51,65,85,1)]" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium group-focus-within/input:text-emerald-500 transition-colors">฿</span>
          </div>
        </div>
      </div>
      
      <div className={`pt-2 mt-1 flex justify-end gap-3 transition-all duration-300 overflow-hidden ${hasChanges ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
        <button type="button" onClick={() => { setRent(String(room.monthlyRent || 0)); setDeposit(String(room.depositAmount || 0)); setError(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border-2 border-slate-700 shadow-[2px_2px_0_0_rgba(51,65,85,1)] hover:bg-slate-700 rounded-xl transition-colors">
          ยกเลิก
        </button>
        <button type="submit" disabled={!hasChanges || saving}
                className="px-5 py-2 text-xs font-bold rounded-2xl bg-[#f7a501] text-black hover:bg-yellow-500 disabled:opacity-50 border-2 border-[#b77a00] shadow-[4px_4px_0_0_#78350f] disabled:border-slate-700 disabled:bg-slate-800 transition-all disabled:cursor-not-allowed flex items-center justify-center min-w-[80px] font-mono">
          {saving ? <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" /> : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [currentRates, setCurrentRates] = useState<Rates | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [elecInput, setElecInput] = useState('');
  const [waterInput, setWaterInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [res, roomsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/rooms')
        ]);
        if (!res.ok) throw new Error(`โหลดการตั้งค่าล้มเหลว (HTTP ${res.status})`);
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const r: Rates = data.rates;
        setCurrentRates(r);
        setElecInput(String(r.electricRate));
        setWaterInput(String(r.waterRate));

        if (roomsRes.ok) {
          const rData = await roomsRes.json();
          if (rData.success) {
            setRooms(rData.rooms);
          }
        }
      } catch (err: unknown) {
        setFetchError(
          err instanceof Error
            ? err.message
            : 'ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อกับ Google Sheets'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSaveRates = async (e: React.FormEvent) => {
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
      if (!res.ok && res.status !== 422) {
        throw new Error(`เซิฟเวอร์ไม่ตอบสนอง (HTTP ${res.status}: ${res.statusText || 'Server Error'})`);
      }
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

  const handleSaveRoom = async (roomId: string, rent: number, deposit: number) => {
    const res = await fetch('/api/rooms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, monthlyRent: rent, depositAmount: deposit })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, monthlyRent: rent, depositAmount: deposit } : r));
  };

  const hasChanges =
    currentRates !== null &&
    (parseFloat(elecInput) !== currentRates.electricRate ||
      parseFloat(waterInput) !== currentRates.waterRate);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">กำลังโหลดการตั้งค่า…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-8 text-slate-300">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16">

        {/* Page header */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            ตั้งค่าระบบ
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            ปรับแต่งอัตราค่าบริการและข้อมูลห้องพักที่มีผลกับบิลรอบใหม่ทั้งหมด
          </p>
        </div>

        {fetchError && (
          <div className="mb-6 bg-red-950/50 border border-red-900 rounded-2xl px-5 py-4 text-red-400 text-sm flex items-start gap-3 shadow-[2px_2px_0_0_rgba(51,65,85,1)]">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <p className="font-bold">โหลดข้อมูลล้มเหลว</p>
              <p className="mt-1 opacity-90">{fetchError}</p>
            </div>
          </div>
        )}

        {/* ── Utilities Section ────────────────────────────────────────── */}
        <div className="mb-14">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="p-1.5 bg-teal-950 text-teal-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </span>
            สาธารณูปโภค (Utilities)
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Current Rates */}
            {currentRates && (
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <StatCard
                  icon={<svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                  label="ค่าไฟปัจจุบัน"
                  value={currentRates.electricRate}
                  unit="บาท / หน่วย"
                  accent="bg-amber-950 border border-amber-900"
                />
                <StatCard
                  icon={<svg className="w-6 h-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707" /><circle cx="12" cy="12" r="4" strokeWidth={2} /></svg>}
                  label="ค่าน้ำปัจจุบัน"
                  value={currentRates.waterRate}
                  unit="บาท / เดือน"
                  accent="bg-teal-950 border border-teal-900"
                />
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSaveRates} className="lg:col-span-3 bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
              <h3 className="text-base font-bold text-white mb-6">แก้ไขอัตราค่าบริการ</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">
                    ค่าไฟฟ้าต่อหน่วย (THB / Unit) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative group/input">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold select-none">⚡</span>
                    <input type="number" min="0.01" step="0.01" value={elecInput} onChange={(e) => { setElecInput(e.target.value); setSaveError(''); setSaveSuccess(false); }} required placeholder="5.00"
                           className="w-full bg-slate-950 border-2 border-slate-700 text-white rounded-2xl pl-12 pr-16 py-3 focus:bg-slate-900 focus:outline-none focus:border-emerald-500 transition shadow-[2px_2px_0_0_rgba(51,65,85,1)]" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium select-none group-focus-within/input:text-emerald-500 transition-colors">฿/หน่วย</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">
                    ค่าน้ำเหมาจ่ายต่อเดือน (THB / Month) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative group/input">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-500 font-bold select-none">💧</span>
                    <input type="number" min="0" step="0.01" value={waterInput} onChange={(e) => { setWaterInput(e.target.value); setSaveError(''); setSaveSuccess(false); }} required placeholder="80.00"
                           className="w-full bg-slate-950 border-2 border-slate-700 text-white rounded-2xl pl-12 pr-16 py-3 focus:bg-slate-900 focus:outline-none focus:border-emerald-500 transition shadow-[2px_2px_0_0_rgba(51,65,85,1)]" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium select-none group-focus-within/input:text-emerald-500 transition-colors">฿/เดือน</span>
                  </div>
                </div>
              </div>

              {saveError && <div className="mt-6 bg-red-950/50 border border-red-900 rounded-xl px-4 py-3 text-red-400 text-sm font-medium">{saveError}</div>}
              {saveSuccess && <div className="mt-6 bg-emerald-950 border border-emerald-900 rounded-xl px-4 py-3 text-emerald-400 text-sm font-medium flex items-center gap-2"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>บันทึกอัตราค่าบริการสำเร็จแล้ว!</div>}

              <div className="mt-8 flex items-center gap-4">
                {hasChanges && !saveSuccess && <p className="text-xs font-medium text-amber-500 flex-1 hidden sm:block">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>}
                <div className="flex gap-3 w-full sm:w-auto ml-auto">
                  <button type="button" onClick={() => { if (currentRates) { setElecInput(String(currentRates.electricRate)); setWaterInput(String(currentRates.waterRate)); } setSaveError(''); setSaveSuccess(false); }} disabled={!hasChanges || saving}
                          className="px-6 py-2.5 rounded-xl border-2 border-slate-700 bg-slate-900 text-slate-300 font-bold hover:bg-slate-800 shadow-[2px_2px_0_0_rgba(51,65,85,1)] disabled:opacity-40 disabled:cursor-not-allowed transition">ยกเลิก</button>
                  <button type="submit" disabled={saving || !hasChanges}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1d4aff] text-white border-2 border-[#1d4aff] font-bold transition-all shadow-[4px_4px_0_0_#1e3a8a] hover:bg-blue-600 disabled:opacity-50 disabled:shadow-none disabled:border-slate-700 disabled:bg-slate-800 min-w-[150px] font-mono">
                    {saving ? <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" /> : 'บันทึกการตั้งค่า'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ── Rooms Section ────────────────────────────────────────── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" /></svg>
              </span>
              จัดการค่าเช่าและมัดจำรายห้อง
            </h2>
            <p className="text-sm text-slate-500 font-medium">พบทั้งหมด {rooms.length} ห้อง</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {rooms.map(room => (
              <RoomSettingCard key={room.roomId} room={room} onSave={handleSaveRoom} />
            ))}
          </div>
        </div>

        <p className="text-center text-xs font-medium text-slate-400 mt-16">
          ข้อมูลเชื่อมต่อและจัดเก็บใน Google Sheets อัตโนมัติ
        </p>
      </div>
    </div>
  );
}
