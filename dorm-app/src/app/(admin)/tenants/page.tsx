'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Tenant } from '@/types';
import { getActiveTenantsForRoom } from '@/lib/tenantUtils';

// ─── Local types ──────────────────────────────────────────────────────────────
interface RoomWithMeta {
  roomId: string;
  roomNumber: string;
  monthlyRent: number;
  lineToken: string;
  prevMeter: number;
  lastStatus: string | null;
  primaryTenantId?: string; // NEW: รองรับคอลัมน์ใหม่จาก API
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
  if (!form.firstname.trim()) errors.firstname = 'กรุณาระบุชื่อ';
  if (!form.lastname.trim()) errors.lastname = 'กรุณาระบุนามสกุล';
  if (!PHONE_RE.test(form.phone.trim())) errors.phone = 'เบอร์โทรศัพท์ต้องมี 10 หลัก';
  if (!DATE_RE.test(form.entryDate.trim()) || isNaN(new Date(form.entryDate).getTime()))
    errors.entryDate = 'วันที่ย้ายเข้าต้องอยู่ในรูปแบบ YYYY-MM-DD';
  return errors;
}

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
      <label className="block text-sm font-medium text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const [rooms, setRooms] = useState<RoomWithMeta[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalRoom, setModalRoom] = useState<RoomWithMeta | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  // State สำหรับปุ่มตั้งผู้ติดต่อหลัก
  const [settingPrimary, setSettingPrimary] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDataError('');
    try {
      const [roomsRes, tenantsRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/tenants'),
      ]);
      if (!roomsRes.ok) throw new Error(`โหลดข้อมูลห้องล้มเหลว (${roomsRes.status})`);
      if (!tenantsRes.ok) throw new Error(`โหลดข้อมูลผู้เช่าล้มเหลว (${tenantsRes.status})`);

      const roomsData = await roomsRes.json();
      const tenantsData = await tenantsRes.json();
      if (!roomsData.success) throw new Error(roomsData.error);
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
    void load();
  }, [load]);

  // ── Build roomId → active tenants map ─────────────────────────────────────────
  const activeTenantsByRoom = new Map<string, Tenant[]>();
  for (const room of rooms) {
    const active = getActiveTenantsForRoom(tenants, room.roomId);
    if (active.length > 0) {
      activeTenantsByRoom.set(room.roomId, active);
    }
  }

  // ── Expandable Rows State ─────────────────────────────────────────────────────
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const toggleRoom = (roomId: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  // ── Modal actions ──────────────────────────────────────────────────────────────
  const openModalForAdd = (room: RoomWithMeta) => {
    setForm(DEFAULT_FORM);
    setEditingTenantId(null);
    setFieldErrors({});
    setSaveError('');
    setModalRoom(room);
  };

  const openModalForEdit = (room: RoomWithMeta, existing: Tenant) => {
    setForm({
      firstname: existing.firstname,
      lastname: existing.lastname,
      phone: existing.phone,
      entryDate: existing.entryDate,
      status: existing.status,
      lineUserId: existing.lineUserId || '',
    });
    setEditingTenantId(existing.tenantId);
    setFieldErrors({});
    setSaveError('');
    setModalRoom(room);
  };

  const closeModal = () => {
    if (saving || settingPrimary) return;
    setModalRoom(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSetPrimary = async () => {
    if (!modalRoom || !editingTenantId) return;
    
    setSettingPrimary(true);
    setSaveError('');
    
    try {
      const res = await fetch(`/api/rooms/${modalRoom.roomId}/primary-tenant`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: editingTenantId }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'ไม่สามารถตั้งเป็นผู้ติดต่อหลักได้');
      }
      
      // อัปเดตข้อมูลใหม่เพื่อดึง primaryTenantId ล่าสุด
      await load();
      
      // อัปเดต state ของ modalRoom ให้สะท้อนค่าปัจจุบัน (ถ้ายังไม่ปิดจอ)
      setModalRoom((prev) => prev ? { ...prev, primaryTenantId: editingTenantId } : null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRoom) return;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const payload = {
        ...form,
        room_id: modalRoom.roomId,
        ...(editingTenantId ? { tenantId: editingTenantId } : {}),
      };

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 400) {
        throw new Error(`เกิดข้อผิดพลาด (HTTP ${res.status}: ${res.statusText})`);
      }

      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error ?? 'บันทึกข้อมูลไม่สำเร็จ');
      }

      // Instead of manual local updates which can be tricky with N-1, reload everything
      await load();
      setModalRoom(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">กำลังโหลดข้อมูลผู้เช่า…</p>
        </div>
      </div>
    );
  }

  if (dataError && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <p className="text-red-600 text-lg font-semibold mb-2">⚠️ เกิดข้อผิดพลาด</p>
          <p className="text-red-500 text-sm mb-6">{dataError}</p>
          <button onClick={load} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors mb-3">
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-600 transition-colors">
            ← กลับหน้าเมนูหลัก
          </Link>
        </div>
      </div>
    );
  }

  const occupiedCount = rooms.filter((r) => activeTenantsByRoom.has(r.roomId)).length;

  // สำหรับการแสดงปุ่มใน Modal
  const isEditingPrimary = modalRoom && editingTenantId && (modalRoom.primaryTenantId ?? activeTenantsByRoom.get(modalRoom.roomId)?.[0]?.tenantId) === editingTenantId;
  const hasMultipleTenants = modalRoom && (activeTenantsByRoom.get(modalRoom.roomId)?.length || 0) > 1;

  return (
    <>
      <div className="w-full flex flex-col gap-6 text-slate-600">
        <div className="max-w-6xl mx-auto w-full">

          <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">จัดการผู้เช่า</h1>
              <p className="text-slate-500 mt-1 text-sm">
                มีผู้เช่าห้อง <span className="text-indigo-600 font-semibold">{occupiedCount}</span> จาก <span className="text-indigo-600 font-semibold">{rooms.length}</span> ห้อง
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />มีผู้เช่า
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />ว่าง
              </span>
            </div>
          </div>

          {/* ── Table View ── */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold w-32">ห้อง</th>
                    <th className="px-6 py-4 font-semibold min-w-[200px]">ผู้ติดต่อหลัก</th>
                    <th className="px-6 py-4 font-semibold min-w-[120px]">เบอร์โทรศัพท์</th>
                    <th className="px-6 py-4 font-semibold min-w-[120px]">ย้ายเข้า</th>
                    <th className="px-6 py-4 font-semibold text-right min-w-[100px]">ค่าเช่า/เดือน</th>
                    <th className="px-6 py-4 font-semibold text-center min-w-[150px]">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {rooms.map((room) => {
                    const activeTenants = activeTenantsByRoom.get(room.roomId) ?? [];
                    const occupied = activeTenants.length > 0;
                    
                    const primaryContactId = room.primaryTenantId ?? activeTenants[0]?.tenantId;
                    const primaryTenant = activeTenants.find(t => t.tenantId === primaryContactId) || activeTenants[0];
                    const otherTenants = activeTenants.filter(t => t.tenantId !== primaryTenant?.tenantId);
                    
                    const isExpanded = expandedRooms.has(room.roomId);

                    return (
                      <React.Fragment key={room.roomId}>
                        {/* Main Row */}
                        <tr className={`group transition-colors hover:bg-white shadow-sm border border-slate-200/30 ${isExpanded ? 'bg-white shadow-sm border border-slate-200/20' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${occupied ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-slate-600'}`} />
                              <span className="font-bold text-slate-800 tracking-wide">{room.roomNumber}</span>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            {occupied ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700">
                                  {primaryTenant.firstname} {primaryTenant.lastname}
                                </span>
                                <span className="inline-block text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                  ✅ ผู้ติดต่อหลัก
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">— ว่าง —</span>
                            )}
                          </td>
                          
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                            {occupied ? primaryTenant.phone : '-'}
                          </td>
                          
                          <td className="px-6 py-4 text-slate-500">
                            {occupied ? primaryTenant.entryDate : '-'}
                          </td>
                          
                          <td className="px-6 py-4 text-right text-slate-600 font-medium">
                            ฿{thb(room.monthlyRent)}
                          </td>
                          
                          <td className="px-6 py-4">
                            {occupied ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openModalForEdit(room, primaryTenant)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-white shadow-sm border border-slate-200 rounded-md transition-colors"
                                  title="แก้ไข"
                                >
                                  ✏️
                                </button>
                                
                                {otherTenants.length > 0 && (
                                  <button
                                    onClick={() => toggleRoom(room.roomId)}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded bg-white shadow-sm border border-slate-200 hover:bg-slate-700 text-slate-600 border border-slate-200 transition-colors"
                                  >
                                    +{otherTenants.length} คน
                                    <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => openModalForAdd(room)}
                                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-white shadow-sm border border-slate-200 rounded-md transition-colors"
                                  title="เพิ่มผู้เช่าร่วม"
                                >
                                  ➕
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <button
                                  onClick={() => openModalForAdd(room)}
                                  className="text-xs font-semibold bg-indigo-600 text-white border border-indigo-500/30 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-all"
                                >
                                  ➕ เพิ่มผู้เช่า
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Other Tenants Sub-rows */}
                        {isExpanded && otherTenants.map((tenant, index) => {
                          const isFirstTenant = tenant.tenantId === activeTenants[0]?.tenantId;
                          
                          return (
                          <tr key={tenant.tenantId} className={`bg-white/50 ${index === otherTenants.length - 1 ? 'border-b border-slate-200/60' : 'border-0'}`}>
                            <td className="px-6 py-3 border-l-[3px] border-indigo-500/40">
                              <div className="pl-6 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                <span className={`text-xs font-medium ${isFirstTenant ? 'text-indigo-600' : 'text-slate-500'}`}>
                                  {isFirstTenant ? 'ผู้เช่าหลัก' : 'ผู้เช่าร่วม'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-500">{tenant.firstname} {tenant.lastname}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-slate-500 font-mono text-xs">{tenant.phone}</td>
                            <td className="px-6 py-3 text-slate-500 text-sm">{tenant.entryDate}</td>
                            <td className="px-6 py-3"></td>
                            <td className="px-6 py-3">
                              <div className="flex justify-center">
                                <button
                                  onClick={() => openModalForEdit(room, tenant)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border border-slate-200 rounded-md transition-colors"
                                  title="แก้ไข"
                                >
                                  ✏️
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {rooms.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500 font-medium">
                        ไม่พบข้อมูลห้องพัก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Add / Edit Tenant ── */}
      {modalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200/50 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{editingTenantId ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มผู้เช่าใหม่'}</h2>
                <p className="text-xs text-slate-500 mt-0.5">ห้อง {modalRoom.roomNumber}</p>
              </div>
              <button onClick={closeModal} disabled={saving || settingPrimary} className="text-slate-500 hover:text-slate-600 text-2xl font-light leading-none disabled:opacity-40">×</button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ชื่อ" error={fieldErrors.firstname} required>
                    <input name="firstname" value={form.firstname} onChange={handleChange} placeholder="สมชาย" className={`w-full bg-white shadow-sm border border-slate-200 border rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${fieldErrors.firstname ? 'border-red-500' : 'border-slate-300'}`} />
                  </Field>
                  <Field label="นามสกุล" error={fieldErrors.lastname} required>
                    <input name="lastname" value={form.lastname} onChange={handleChange} placeholder="ใจดี" className={`w-full bg-white shadow-sm border border-slate-200 border rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${fieldErrors.lastname ? 'border-red-500' : 'border-slate-300'}`} />
                  </Field>
                </div>

                <Field label="เบอร์โทรศัพท์" error={fieldErrors.phone} required>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="0812345678" maxLength={10} inputMode="numeric" className={`w-full bg-white shadow-sm border border-slate-200 border rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono ${fieldErrors.phone ? 'border-red-500' : 'border-slate-300'}`} />
                </Field>

                <Field label="Line ID (ถ้ามี)" error={fieldErrors.lineUserId}>
                  <input name="lineUserId" value={form.lineUserId} onChange={handleChange} placeholder="เช่น @dorm123 หรือ UserID" className={`w-full bg-white shadow-sm border border-slate-200 border rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${fieldErrors.lineUserId ? 'border-red-500' : 'border-slate-300'}`} />
                </Field>

                <Field label="วันที่ย้ายเข้า" error={fieldErrors.entryDate} required>
                  <input type="date" name="entryDate" value={form.entryDate} onChange={handleChange} className={`w-full bg-white shadow-sm border border-slate-200 border rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${fieldErrors.entryDate ? 'border-red-500' : 'border-slate-300'}`} />
                </Field>

                <Field label="สถานะ">
                  <select name="status" value={form.status} onChange={handleChange} className="w-full bg-white shadow-sm border border-slate-200 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
                    <option value="ACTIVE">ACTIVE — กำลังพักอาศัย</option>
                    <option value="INACTIVE">INACTIVE — ย้ายออกแล้ว</option>
                  </select>
                </Field>

                {/* ปุ่มตั้งผู้ติดต่อหลัก (ข) แสดงเฉพาะตอนแก้ไขข้อมูล และห้องนั้นมีผู้อาศัยมากกว่า 1 คน */}
                {editingTenantId && hasMultipleTenants && (
                  <div className="pt-2 pb-1 border-t border-slate-200/50 mt-2">
                    <button
                      type="button"
                      onClick={handleSetPrimary}
                      disabled={isEditingPrimary || settingPrimary}
                      className={`w-full py-2 rounded-xl text-sm font-medium transition-colors border
                        ${isEditingPrimary 
                          ? 'bg-slate-50 hover:bg-slate-100 text-emerald-500/70 border-emerald-800/30 cursor-not-allowed' 
                          : 'bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-700 border-emerald-800'}`}
                    >
                      {settingPrimary 
                        ? '⏳ กำลังตั้งค่า...' 
                        : isEditingPrimary 
                          ? '✅ เป็นผู้ติดต่อหลักอยู่แล้ว' 
                          : '⭐ ตั้งเป็นผู้ติดต่อหลักห้องนี้'}
                    </button>
                  </div>
                )}

                {saveError && <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300">⚠️ {saveError}</div>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} disabled={saving || settingPrimary} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-white shadow-sm border border-slate-200 text-sm font-medium transition-colors disabled:opacity-40">ยกเลิก</button>
                  <button type="submit" disabled={saving || settingPrimary} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-900/40 disabled:shadow-none disabled:cursor-not-allowed">
                    {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
