'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Tenant } from '@/types';

// ─── Local types ──────────────────────────────────────────────────────────────

interface RoomWithMeta {
  roomId: string;
  roomNumber: string;
  monthlyRent: number;
  lineToken: string;
  prevMeter: number;
  lastStatus: string | null;
}

interface TenantForm {
  firstname: string;
  lastname: string;
  phone: string;
  entryDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  lineUserId: string;
}

const DEFAULT_FORM: TenantForm = {
  firstname: '',
  lastname: '',
  phone: '',
  entryDate: '',
  status: 'ACTIVE',
  lineUserId: '',
};

// ─── Client-side validation ───────────────────────────────────────────────────

const PHONE_RE = /^\d{10}$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

function validateForm(form: TenantForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.firstname.trim())
    errors.firstname = 'กรุณาระบุชื่อ';
  if (!form.lastname.trim())
    errors.lastname = 'กรุณาระบุนามสกุล';
  if (!PHONE_RE.test(form.phone.trim()))
    errors.phone = 'เบอร์โทรศัพท์ต้องมี 10 หลัก';
  if (!DATE_RE.test(form.entryDate.trim()) || isNaN(new Date(form.entryDate).getTime()))
    errors.entryDate = 'วันที่ย้ายเข้าต้องอยู่ในรูปแบบ YYYY-MM-DD';
  return errors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const thb = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}
function Field({ label, error, children, required }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  // ── Data state ───────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<RoomWithMeta[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalRoom, setModalRoom] = useState<RoomWithMeta | null>(null);
  const [form, setForm] = useState<TenantForm>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setDataError('');
    try {
      const [roomsRes, tenantsRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/tenants'),
      ]);
      if (!roomsRes.ok)   throw new Error(`โหลดข้อมูลห้องล้มเหลว (${roomsRes.status})`);
      if (!tenantsRes.ok) throw new Error(`โหลดข้อมูลผู้เช่าล้มเหลว (${tenantsRes.status})`);

      const roomsData   = await roomsRes.json();
      const tenantsData = await tenantsRes.json();

      if (!roomsData.success)   throw new Error(roomsData.error);
      if (!tenantsData.success) throw new Error(tenantsData.error);

      setRooms(roomsData.rooms);
      setTenants(tenantsData.tenants);
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

  // ── Build roomId → active tenant map ─────────────────────────────────────────
  // 1. Get the absolute latest record for each room (last append wins)
  const latestTenantByRoom = new Map<string, Tenant>();
  for (const t of tenants) {
    latestTenantByRoom.set(t.room_id, t);
  }
  
  // 2. Filter to keep only rooms where the LATEST status is ACTIVE
  const activeTenantByRoom = new Map<string, Tenant>();
  for (const [roomId, t] of latestTenantByRoom.entries()) {
    if (t.status === 'ACTIVE') {
      activeTenantByRoom.set(roomId, t);
    }
  }

  // ── Modal open/close ──────────────────────────────────────────────────────────
  const openModal = (room: RoomWithMeta) => {
    const existing = activeTenantByRoom.get(room.roomId);
    setForm(
      existing
        ? {
            firstname: existing.firstname,
            lastname:  existing.lastname,
            phone:     existing.phone,
            entryDate: existing.entryDate,
            status:    existing.status,
            lineUserId: existing.lineUserId || '',
          }
        : DEFAULT_FORM
    );
    setFieldErrors({});
    setSaveError('');
    setModalRoom(room);
  };

  const closeModal = () => {
    if (saving) return;
    setModalRoom(null);
  };

  // ── Field change ──────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear per-field error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRoom) return;

    // Client-side validation BEFORE any network call
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, room_id: modalRoom.roomId }),
      });

      if (!res.ok && res.status !== 400) {
        throw new Error(`เกิดข้อผิดพลาด (HTTP ${res.status}: ${res.statusText})`);
      }

      const data = await res.json();

      if (!data.success) {
        // Server returned structured fieldErrors — merge into local state
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        throw new Error(data.error ?? 'บันทึกข้อมูลไม่สำเร็จ');
      }

      // Optimistically add the new tenant to local state and close modal
      setTenants((prev) => [...prev, data.tenant as Tenant]);
      setModalRoom(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ── Render: loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดข้อมูลผู้เช่า…</p>
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
  const occupiedCount = rooms.filter((r) => activeTenantByRoom.has(r.roomId)).length;

  return (
    <>
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
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">จัดการผู้เช่า</h1>
              <p className="text-slate-400 mt-1 text-sm">
                มีผู้เช่า{' '}
                <span className="text-indigo-400 font-semibold">{occupiedCount}</span>
                {' '}จาก{' '}
                <span className="text-indigo-400 font-semibold">{rooms.length}</span>
                {' '}ห้อง
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />มีผู้เช่า
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />ว่าง
              </span>
            </div>
          </div>

          {/* Room grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map((room) => {
              const tenant = activeTenantByRoom.get(room.roomId);
              const occupied = !!tenant;
              return (
                <div
                  key={room.roomId}
                  className={`
                    bg-slate-900 rounded-2xl border p-5 flex flex-col gap-4
                    transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5
                    ${occupied
                      ? 'border-emerald-700/40 hover:border-emerald-600/60'
                      : 'border-slate-700 hover:border-slate-600'}
                  `}
                >
                  {/* Room badge + status dot */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${occupied ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        ห้อง {room.roomNumber}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      ฿{thb(room.monthlyRent)}/เดือน
                    </span>
                  </div>

                  {/* Tenant info */}
                  {tenant ? (
                    <div className="flex-1 space-y-1.5">
                      <p className="text-base font-bold text-white leading-snug">
                        {tenant.firstname} {tenant.lastname}
                      </p>
                      <p className="text-sm text-slate-400">📱 {tenant.phone}</p>
                      <p className="text-xs text-slate-500">เข้าพักวันที่ {tenant.entryDate}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-3">
                      <p className="text-slate-600 text-sm">— ยังไม่มีผู้เช่า —</p>
                    </div>
                  )}

                  {/* Action button */}
                  <button
                    onClick={() => openModal(room)}
                    className={`
                      w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200
                      ${occupied
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'}
                    `}
                  >
                    {occupied ? '✏️ แก้ไขข้อมูลผู้เช่า' : '➕ เพิ่มผู้เช่า'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modal overlay ── */}
      {modalRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h2 className="text-base font-bold text-white">
                  {activeTenantByRoom.has(modalRoom.roomId)
                    ? 'แก้ไขข้อมูลผู้เช่า'
                    : 'เพิ่มผู้เช่าใหม่'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">ห้อง {modalRoom.roomNumber}</p>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="text-slate-500 hover:text-slate-300 text-2xl font-light leading-none disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>

              {/* Firstname + Lastname side by side */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="ชื่อ" error={fieldErrors.firstname} required>
                  <input
                    name="firstname"
                    value={form.firstname}
                    onChange={handleChange}
                    placeholder="สมชาย"
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white
                                placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                focus:border-transparent transition
                                ${fieldErrors.firstname ? 'border-red-500' : 'border-slate-600'}`}
                  />
                </Field>

                <Field label="นามสกุล" error={fieldErrors.lastname} required>
                  <input
                    name="lastname"
                    value={form.lastname}
                    onChange={handleChange}
                    placeholder="ใจดี"
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white
                                placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                focus:border-transparent transition
                                ${fieldErrors.lastname ? 'border-red-500' : 'border-slate-600'}`}
                  />
                </Field>
              </div>

              {/* Phone */}
              <Field label="เบอร์โทรศัพท์" error={fieldErrors.phone} required>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0812345678"
                  maxLength={10}
                  inputMode="numeric"
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white
                              placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500
                              focus:border-transparent transition font-mono
                              ${fieldErrors.phone ? 'border-red-500' : 'border-slate-600'}`}
                />
              </Field>

              {/* Line ID */}
              <Field label="Line ID (ถ้ามี)" error={fieldErrors.lineUserId}>
                <input
                  name="lineUserId"
                  value={form.lineUserId}
                  onChange={handleChange}
                  placeholder="เช่น @dorm123 หรือ UserID"
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white
                              placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500
                              focus:border-transparent transition
                              ${fieldErrors.lineUserId ? 'border-red-500' : 'border-slate-600'}`}
                />
              </Field>

              {/* Entry date */}
              <Field label="วันที่ย้ายเข้า" error={fieldErrors.entryDate} required>
                <input
                  type="date"
                  name="entryDate"
                  value={form.entryDate}
                  onChange={handleChange}
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white
                              focus:outline-none focus:ring-2 focus:ring-indigo-500
                              focus:border-transparent transition
                              ${fieldErrors.entryDate ? 'border-red-500' : 'border-slate-600'}`}
                />
              </Field>

              {/* Status */}
              <Field label="สถานะ">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2
                             text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                             focus:border-transparent transition"
                >
                  <option value="ACTIVE">ACTIVE — กำลังพักอาศัย</option>
                  <option value="INACTIVE">INACTIVE — ย้ายออกแล้ว</option>
                </select>
              </Field>

              {/* Save error */}
              {saveError && (
                <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300">
                  ⚠️ {saveError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300
                             hover:bg-slate-800 text-sm font-medium transition-colors
                             disabled:opacity-40"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700
                             disabled:text-slate-500 text-white font-semibold text-sm
                             transition-all duration-200 shadow-lg shadow-indigo-900/40
                             disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      กำลังบันทึก…
                    </>
                  ) : (
                    '💾 บันทึก'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
