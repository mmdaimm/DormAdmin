'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Tenant, Invoice } from '@/types';
import { getActiveTenantsForRoom } from '@/lib/tenantUtils';
import type { SettlementResult } from '@/services/settlementCalculator';

// ─── Local types ──────────────────────────────────────────────────────────────
interface RoomWithMeta {
  roomId: string;
  roomNumber: string;
  monthlyRent: number;
  lineToken: string;
  prevMeter: number;
  lastStatus: string | null;
  depositAmount?: number;
  primaryTenantId?: string;
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

const getTodayStr = () => new Date().toISOString().split('T')[0];

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
      <label className="block text-sm font-medium text-slate-400 mb-1.5">
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

  // ── Modal state: Add/Edit Tenant ─────────────────────────────────────────────
  const [modalRoom, setModalRoom] = useState<RoomWithMeta | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [settingPrimary, setSettingPrimary] = useState(false);

  // ── Modal state: Move-In Wizard ──────────────────────────────────────────────
  const [moveInRoom, setMoveInRoom] = useState<RoomWithMeta | null>(null);
  const [moveInForm, setMoveInForm] = useState({
    firstname: '',
    lastname: '',
    phone: '',
    entryDate: getTodayStr(),
    depositAmount: '',
    monthlyRent: '',
    lineUserId: '',
  });
  const [moveInErrors, setMoveInErrors] = useState<Record<string, string>>({});
  const [executingMoveIn, setExecutingMoveIn] = useState(false);
  const [moveInErrorMsg, setMoveInErrorMsg] = useState('');

  // ── Modal state: Move-Out Settlement Wizard ─────────────────────────────────
  const [moveOutRoom, setMoveOutRoom] = useState<RoomWithMeta | null>(null);
  const [moveOutForm, setMoveOutForm] = useState({
    moveOutDate: getTodayStr(),
    finalElectricMeter: '',
    damageFee: '0',
    damageNotes: '',
    isFullMonthRent: false,
    overrideForfeit: false,
  });
  const [settlementPreview, setSettlementPreview] = useState<SettlementResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [executingMoveOut, setExecutingMoveOut] = useState(false);
  const [moveOutErrorMsg, setMoveOutErrorMsg] = useState('');

  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  const toggleRoom = (roomId: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

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

  // Build active tenants map
  const activeTenantsByRoom = new Map<string, Tenant[]>();
  for (const r of rooms) {
    activeTenantsByRoom.set(r.roomId, getActiveTenantsForRoom(tenants, r.roomId));
  }

  // ── Open Modals ─────────────────────────────────────────────────────────────
  const openModalForAdd = (room: RoomWithMeta) => {
    setModalRoom(room);
    setEditingTenantId(null);
    setForm({ ...DEFAULT_FORM, entryDate: getTodayStr() });
    setFieldErrors({});
    setSaveError('');
  };

  const openModalForEdit = (room: RoomWithMeta, tenant: Tenant) => {
    setModalRoom(room);
    setEditingTenantId(tenant.tenantId);
    setForm({
      firstname: tenant.firstname,
      lastname: tenant.lastname,
      phone: tenant.phone,
      entryDate: tenant.entryDate,
      status: tenant.status,
      lineUserId: tenant.lineUserId ?? '',
    });
    setFieldErrors({});
    setSaveError('');
  };

  const openMoveInModal = (room?: RoomWithMeta) => {
    const targetRoom = room || rooms.find((r) => !activeTenantsByRoom.get(r.roomId)?.length) || rooms[0];
    setMoveInRoom(targetRoom || null);
    setMoveInForm({
      firstname: '',
      lastname: '',
      phone: '',
      entryDate: getTodayStr(),
      depositAmount: targetRoom?.depositAmount ? String(targetRoom.depositAmount) : '',
      monthlyRent: targetRoom?.monthlyRent ? String(targetRoom.monthlyRent) : '',
      lineUserId: '',
    });
    setMoveInErrors({});
    setMoveInErrorMsg('');
  };

  const openMoveOutModal = (room: RoomWithMeta) => {
    setMoveOutRoom(room);
    setMoveOutForm({
      moveOutDate: getTodayStr(),
      finalElectricMeter: String(room.prevMeter || 0),
      damageFee: '0',
      damageNotes: '',
      isFullMonthRent: false,
      overrideForfeit: false,
    });
    setSettlementPreview(null);
    setPreviewError('');
    setMoveOutErrorMsg('');
  };

  const closeModal = () => {
    setModalRoom(null);
    setEditingTenantId(null);
    setForm(DEFAULT_FORM);
    setSaveError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
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
      await load();
      setModalRoom((prev) => (prev ? { ...prev, primaryTenantId: editingTenantId } : null));
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

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error ?? 'บันทึกข้อมูลไม่สำเร็จ');
      }

      await load();
      setModalRoom(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ── Move-In Submission Handler ─────────────────────────────────────────────
  const handleMoveInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveInRoom) return;

    const errors: Record<string, string> = {};
    if (!moveInForm.firstname.trim()) errors.firstname = 'กรุณาระบุชื่อ';
    if (!moveInForm.lastname.trim()) errors.lastname = 'กรุณาระบุนามสกุล';
    if (!PHONE_RE.test(moveInForm.phone.trim())) errors.phone = 'เบอร์โทรศัพท์ต้องมี 10 หลัก';
    if (!DATE_RE.test(moveInForm.entryDate.trim())) errors.entryDate = 'วันที่ย้ายเข้าต้องอยู่ในรูปแบบ YYYY-MM-DD';

    if (Object.keys(errors).length > 0) {
      setMoveInErrors(errors);
      return;
    }

    setExecutingMoveIn(true);
    setMoveInErrorMsg('');

    try {
      const res = await fetch('/api/tenants/move-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: moveInForm.firstname,
          lastname: moveInForm.lastname,
          phone: moveInForm.phone,
          room_id: moveInRoom.roomId,
          entryDate: moveInForm.entryDate,
          lineUserId: moveInForm.lineUserId,
          depositAmount: moveInForm.depositAmount ? parseFloat(moveInForm.depositAmount) : undefined,
          monthlyRent: moveInForm.monthlyRent ? parseFloat(moveInForm.monthlyRent) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.fieldErrors) setMoveInErrors(data.fieldErrors);
        throw new Error(data.error ?? 'ไม่สามารถดำเนินการย้ายเข้าได้');
      }

      await load();
      setMoveInRoom(null);
    } catch (err: unknown) {
      setMoveInErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการย้ายเข้า');
    } finally {
      setExecutingMoveIn(false);
    }
  };

  // ── Move-Out Preview & Execution Handlers ──────────────────────────────────
  const handleMoveOutPreview = async () => {
    if (!moveOutRoom) return;
    setPreviewing(true);
    setPreviewError('');
    setSettlementPreview(null);

    try {
      const res = await fetch('/api/tenants/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: moveOutRoom.roomId,
          moveOutDate: moveOutForm.moveOutDate,
          finalElectricMeter: parseFloat(moveOutForm.finalElectricMeter || '0'),
          damageFee: parseFloat(moveOutForm.damageFee || '0'),
          damageNotes: moveOutForm.damageNotes,
          isFullMonthRent: moveOutForm.isFullMonthRent,
          overrideForfeit: moveOutForm.overrideForfeit,
          isPreview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'ไม่สามารถคำนวณการปิดบัญชีย้ายออกได้');
      }
      setSettlementPreview(data.settlement);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการคำนวณ');
    } finally {
      setPreviewing(false);
    }
  };

  const handleMoveOutConfirm = async () => {
    if (!moveOutRoom || !settlementPreview) return;
    setExecutingMoveOut(true);
    setMoveOutErrorMsg('');

    try {
      let uploadedPdfUrl = '';
      try {
        const currentMonthCharges = settlementPreview.proratedRent + settlementPreview.electricityBill + settlementPreview.waterBill + settlementPreview.damageFee;
        const dummyInvoice: Invoice = {
          invoiceId: `INV-${moveOutRoom.roomId}-${settlementPreview.period}`,
          roomId: moveOutRoom.roomId,
          period: settlementPreview.period,
          prevMeter: settlementPreview.prevElectricMeter,
          currMeter: settlementPreview.finalElectricMeter,
          waterBill: settlementPreview.waterBill,
          otherBill: settlementPreview.damageFee,
          arrears: settlementPreview.arrears,
          totalAmount: currentMonthCharges,
          paidAmount: settlementPreview.additionalPayAmount === 0 ? settlementPreview.totalCharges : 0,
          status: settlementPreview.additionalPayAmount === 0 ? 'PAID' : 'UNPAID',
          remainingArrears: settlementPreview.arrears,
          creditApplied: settlementPreview.creditBalance,
          proratedAmount: settlementPreview.monthlyRent - settlementPreview.proratedRent,
          isNewFormat: true,
        };

        const { pdf } = await import('@react-pdf/renderer');
        const { SlipPdf } = await import('@/components/pdf/SlipPdf');

        const blob = await pdf(
          <SlipPdf invoice={dummyInvoice} roomNumber={moveOutRoom.roomNumber} type="SETTLEMENT" electricRate={5} />
        ).toBlob();

        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const yyyy = now.getFullYear();
        const fileName = `${moveOutRoom.roomNumber}${mm}${dd}${yyyy}_OUT.pdf`;

        const formData = new FormData();
        formData.append('pdf', blob, fileName);
        formData.append('roomNumber', moveOutRoom.roomNumber);

        const uploadRes = await fetch('/api/upload-bill', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.success) {
            uploadedPdfUrl = uploadData.url;
          }
        }
      } catch (pdfErr) {
        console.warn('[handleMoveOutConfirm] PDF generation/upload failed, proceeding with move-out:', pdfErr);
      }

      const res = await fetch('/api/tenants/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: moveOutRoom.roomId,
          moveOutDate: moveOutForm.moveOutDate,
          finalElectricMeter: parseFloat(moveOutForm.finalElectricMeter || '0'),
          damageFee: parseFloat(moveOutForm.damageFee || '0'),
          damageNotes: moveOutForm.damageNotes,
          isFullMonthRent: moveOutForm.isFullMonthRent,
          overrideForfeit: moveOutForm.overrideForfeit,
          pdfUrl: uploadedPdfUrl,
          isPreview: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'ไม่สามารถบันทึกการย้ายออกได้');
      }

      await load();
      setMoveOutRoom(null);
      setSettlementPreview(null);
    } catch (err: unknown) {
      setMoveOutErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการย้ายออก');
    } finally {
      setExecutingMoveOut(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดข้อมูลผู้เช่า…</p>
        </div>
      </div>
    );
  }

  if (dataError && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border-2 border-red-900 rounded-2xl p-8 max-w-md w-full text-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <p className="text-red-500 text-lg font-semibold mb-2">⚠️ เกิดข้อผิดพลาด</p>
          <p className="text-red-400 text-sm mb-6">{dataError}</p>
          <button onClick={load} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors mb-3 shadow-[4px_4px_0_0_#1d4aff] font-mono">
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
            ← กลับหน้าเมนูหลัก
          </Link>
        </div>
      </div>
    );
  }

  const occupiedCount = rooms.filter((r) => activeTenantsByRoom.get(r.roomId)?.length).length;

  return (
    <>
      <div className="w-full flex flex-col gap-6 text-slate-300">
        <div className="max-w-6xl mx-auto w-full">

          <div className="mb-8 flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">จัดการผู้เช่า</h1>
              <p className="text-slate-400 mt-1 text-sm">
                มีผู้เช่าห้อง <span className="text-emerald-400 font-semibold">{occupiedCount}</span> จาก <span className="text-emerald-400 font-semibold">{rooms.length}</span> ห้อง
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => openMoveInModal()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all border-2 border-emerald-500 shadow-[4px_4px_0_0_#059669] flex items-center gap-2"
              >
                <span>➕</span> ลงทะเบียนย้ายเข้า
              </button>
            </div>
          </div>

          {/* ── Table View ── */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="px-6 py-4 font-semibold w-32">ห้อง</th>
                    <th className="px-6 py-4 font-semibold min-w-[200px]">ผู้ติดต่อหลัก</th>
                    <th className="px-6 py-4 font-semibold min-w-[120px]">เบอร์โทรศัพท์</th>
                    <th className="px-6 py-4 font-semibold min-w-[120px]">ย้ายเข้า</th>
                    <th className="px-6 py-4 font-semibold text-right min-w-[100px]">ค่าเช่า/เดือน</th>
                    <th className="px-6 py-4 font-semibold text-center min-w-[180px]">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {rooms.map((room) => {
                    const activeTenants = activeTenantsByRoom.get(room.roomId) ?? [];
                    const occupied = activeTenants.length > 0;

                    const primaryContactId = room.primaryTenantId ?? activeTenants[0]?.tenantId;
                    const primaryTenant = activeTenants.find((t) => t.tenantId === primaryContactId) || activeTenants[0];
                    const otherTenants = activeTenants.filter((t) => t.tenantId !== primaryTenant?.tenantId);

                    const isExpanded = expandedRooms.has(room.roomId);

                    return (
                      <React.Fragment key={room.roomId}>
                        <tr className={`group transition-colors hover:bg-slate-800 border-b border-slate-800/40 ${isExpanded ? 'bg-slate-800/60' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-2.5 h-2.5 rounded-full ${occupied ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-slate-600'}`} />
                              <span className="font-bold text-white text-base tracking-wide">{room.roomNumber}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {occupied ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-200">
                                  {primaryTenant.firstname} {primaryTenant.lastname}
                                </span>
                                <span className="inline-block text-[10px] font-bold bg-[#1d1f27] text-[#f7a501] px-1.5 py-0.5 rounded border border-[#b77a00]">
                                  ✅ หลัก
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">— ห้องว่าง —</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                            {occupied ? primaryTenant.phone : '-'}
                          </td>

                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {occupied ? primaryTenant.entryDate : '-'}
                          </td>

                          <td className="px-6 py-4 text-right text-slate-300 font-medium font-mono">
                            ฿{thb(room.monthlyRent)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              {occupied ? (
                                <>
                                  <button
                                    onClick={() => openModalForEdit(room, primaryTenant)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                                    title="แก้ไขข้อมูลผู้เช่า"
                                  >
                                    ✏️
                                  </button>

                                  <button
                                    onClick={() => openMoveOutModal(room)}
                                    className="px-2.5 py-1 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900 border border-rose-800 rounded-lg transition-colors shadow-[2px_2px_0_0_#991b1b]"
                                    title="ดำเนินการย้ายออก"
                                  >
                                    🔴 ย้ายออก
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openMoveInModal(room)}
                                  className="px-3 py-1 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-800 rounded-lg transition-colors shadow-[2px_2px_0_0_#065f46]"
                                >
                                  🟢 ย้ายเข้า
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal 1: Add/Edit Tenant ── */}
      {modalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-[8px_8px_0_0_rgba(15,23,42,1)] flex flex-col max-h-[90vh] overflow-hidden border-2 border-slate-800">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{editingTenantId ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มผู้เช่าใหม่'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">ห้อง {modalRoom.roomNumber}</p>
              </div>
              <button onClick={closeModal} disabled={saving || settingPrimary} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ชื่อ" error={fieldErrors.firstname} required>
                    <input name="firstname" value={form.firstname} onChange={handleChange} placeholder="สมชาย" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition" />
                  </Field>
                  <Field label="นามสกุล" error={fieldErrors.lastname} required>
                    <input name="lastname" value={form.lastname} onChange={handleChange} placeholder="ใจดี" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition" />
                  </Field>
                </div>

                <Field label="เบอร์โทรศัพท์" error={fieldErrors.phone} required>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="0812345678" maxLength={10} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition" />
                </Field>

                <Field label="วันที่ย้ายเข้า" error={fieldErrors.entryDate} required>
                  <input type="date" name="entryDate" value={form.entryDate} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition" />
                </Field>

                {saveError && <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-400">⚠️ {saveError}</div>}

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-sm font-bold">ยกเลิก</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-[4px_4px_0_0_#1d4aff]">
                    {saving ? 'กำลังบันทึก…' : '💾 บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Move-In Wizard ── */}
      {moveInRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMoveInRoom(null)} />

          <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-[8px_8px_0_0_rgba(15,23,42,1)] flex flex-col max-h-[90vh] overflow-hidden border-2 border-slate-800">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">🟢 ลงทะเบียนย้ายเข้า (Move-In)</h2>
                <p className="text-xs text-slate-400 mt-0.5">เลือกห้องพักและกรอกข้อมูลผู้เช่าใหม่</p>
              </div>
              <button onClick={() => setMoveInRoom(null)} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <form onSubmit={handleMoveInSubmit} className="space-y-4">
                <Field label="ห้องพัก" required>
                  <select
                    value={moveInRoom.roomId}
                    onChange={(e) => {
                      const selected = rooms.find((r) => r.roomId === e.target.value);
                      if (selected) setMoveInRoom(selected);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {rooms.map((r) => (
                      <option key={r.roomId} value={r.roomId}>
                        ห้อง {r.roomNumber} ({activeTenantsByRoom.get(r.roomId)?.length ? 'มีผู้เช่า' : 'ว่าง'}) - ค่าเช่า ฿{thb(r.monthlyRent)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="ชื่อ" error={moveInErrors.firstname} required>
                    <input
                      value={moveInForm.firstname}
                      onChange={(e) => setMoveInForm({ ...moveInForm, firstname: e.target.value })}
                      placeholder="สมชาย"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </Field>
                  <Field label="นามสกุล" error={moveInErrors.lastname} required>
                    <input
                      value={moveInForm.lastname}
                      onChange={(e) => setMoveInForm({ ...moveInForm, lastname: e.target.value })}
                      placeholder="ใจดี"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </Field>
                </div>

                <Field label="เบอร์โทรศัพท์ (10 หลัก)" error={moveInErrors.phone} required>
                  <input
                    value={moveInForm.phone}
                    onChange={(e) => setMoveInForm({ ...moveInForm, phone: e.target.value })}
                    placeholder="0812345678"
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="วันที่ย้ายเข้า" error={moveInErrors.entryDate} required>
                    <input
                      type="date"
                      value={moveInForm.entryDate}
                      onChange={(e) => setMoveInForm({ ...moveInForm, entryDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </Field>

                  <Field label="เงินประกันมัดจำ (บาท)">
                    <input
                      type="number"
                      value={moveInForm.depositAmount}
                      onChange={(e) => setMoveInForm({ ...moveInForm, depositAmount: e.target.value })}
                      placeholder="เช่น 5000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </Field>
                </div>

                {moveInErrorMsg && <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-400">⚠️ {moveInErrorMsg}</div>}

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button type="button" onClick={() => setMoveInRoom(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-sm font-bold">ยกเลิก</button>
                  <button type="submit" disabled={executingMoveIn} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-[4px_4px_0_0_#059669]">
                    {executingMoveIn ? 'กำลังบันทึก…' : '✅ ยืนยันย้ายเข้า'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Move-Out Settlement Wizard ── */}
      {moveOutRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMoveOutRoom(null)} />

          <div className="relative w-full max-w-xl bg-slate-900 rounded-2xl shadow-[8px_8px_0_0_rgba(15,23,42,1)] flex flex-col max-h-[90vh] overflow-hidden border-2 border-slate-800">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">🔴 ปิดบัญชีย้ายออก (Move-Out Settlement)</h2>
                <p className="text-xs text-slate-400 mt-0.5">ห้อง {moveOutRoom.roomNumber} — คำนวณยอดมัดจำคืน/ชำระเพิ่ม</p>
              </div>
              <button onClick={() => setMoveOutRoom(null)} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="วันที่ย้ายออก" required>
                  <input
                    type="date"
                    value={moveOutForm.moveOutDate}
                    onChange={(e) => setMoveOutForm({ ...moveOutForm, moveOutDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </Field>

                <Field label="เลขมิเตอร์ไฟสุดท้าย (kWh)" required>
                  <input
                    type="number"
                    value={moveOutForm.finalElectricMeter}
                    onChange={(e) => setMoveOutForm({ ...moveOutForm, finalElectricMeter: e.target.value })}
                    placeholder={`เดิม: ${moveOutRoom.prevMeter}`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ค่าปรับ/ค่าทำความสะอาด (บาท)">
                  <input
                    type="number"
                    value={moveOutForm.damageFee}
                    onChange={(e) => setMoveOutForm({ ...moveOutForm, damageFee: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </Field>

                <Field label="หมายเหตุความเสียหาย">
                  <input
                    type="text"
                    value={moveOutForm.damageNotes}
                    onChange={(e) => setMoveOutForm({ ...moveOutForm, damageNotes: e.target.value })}
                    placeholder="เช่น ค่าทำความสะอาดแอร์"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </Field>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-amber-400 cursor-pointer select-none bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-xl hover:bg-amber-950/50 transition">
                  <input
                    type="checkbox"
                    checked={moveOutForm.overrideForfeit}
                    onChange={(e) => setMoveOutForm({ ...moveOutForm, overrideForfeit: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                  />
                  <span>อนุมัติคืนเงินมัดจำกรณีพิเศษ (ข้ามการริบเงินมัดจำ)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleMoveOutPreview}
                disabled={previewing}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-[4px_4px_0_0_#1d4aff] transition-all"
              >
                {previewing ? 'กำลังคำนวณ…' : '🧮 คำนวณสรุปยอดปิดบัญชี (Preview)'}
              </button>

              {previewError && <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-400">⚠️ {previewError}</div>}

              {/* Settlement Preview Summary Card */}
              {settlementPreview && (
                <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-emerald-400 text-sm">📋 สรุปรายการปิดบัญชีย้ายออก</h3>
                    {settlementPreview.minStayMonths > 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${settlementPreview.isDepositForfeited ? 'bg-rose-950 border-rose-800 text-rose-400' : 'bg-emerald-950 border-emerald-800 text-emerald-400'}`}>
                        {settlementPreview.isDepositForfeited
                          ? `🔴 อยู่ไม่ครบสัญญา (${settlementPreview.monthsStayed}/${settlementPreview.minStayMonths} เดือน) ริบมัดจำ`
                          : `🟢 อยู่ครบสัญญา (${settlementPreview.monthsStayed}/${settlementPreview.minStayMonths} เดือน) คืนมัดจำ`}
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-300 font-mono">
                    <div className="flex justify-between">
                      <span>ค่าเช่าเดือนสุดท้าย (Prorated):</span>
                      <span className="text-white">฿{thb(settlementPreview.proratedRent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ค่าไฟ ({settlementPreview.unitsUsed} หน่วย):</span>
                      <span className="text-white">฿{thb(settlementPreview.electricityBill)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ค่าน้ำ:</span>
                      <span className="text-white">฿{thb(settlementPreview.waterBill)}</span>
                    </div>
                    {settlementPreview.damageFee > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>ค่าเสียหาย/ทำความสะอาด:</span>
                        <span>฿{thb(settlementPreview.damageFee)}</span>
                      </div>
                    )}
                    {settlementPreview.arrears > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>ค้างชำระเดิม (Arrears):</span>
                        <span>฿{thb(settlementPreview.arrears)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-slate-200">
                      <span>รวมค่าใช้จ่ายทั้งหมด:</span>
                      <span>฿{thb(settlementPreview.totalCharges)}</span>
                    </div>

                    <div className="border-t border-slate-800 pt-1.5 flex justify-between">
                      {settlementPreview.isDepositForfeited ? (
                        <>
                          <span className="text-rose-400 font-sans">เงินประกันมัดจำ (ริบเนื่องจากอยู่ไม่ครบสัญญา):</span>
                          <span className="text-rose-400">฿0.00</span>
                        </>
                      ) : (
                        <>
                          <span className="text-emerald-400 font-sans">เงินประกันมัดจำ (หักคืนผู้เช่า):</span>
                          <span className="text-emerald-400">-฿{thb(settlementPreview.effectiveDeposit)}</span>
                        </>
                      )}
                    </div>
                    {settlementPreview.creditBalance > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>เงินเครดิตสะสมคงเหลือ:</span>
                        <span>-฿{thb(settlementPreview.creditBalance)}</span>
                      </div>
                    )}
                  </div>

                  {/* Net Amount Banner */}
                  <div className={`p-3 rounded-lg border text-center font-bold text-base ${settlementPreview.refundAmount > 0 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-rose-950/60 border-rose-700 text-rose-300'}`}>
                    {settlementPreview.refundAmount > 0 ? (
                      <div>💵 ยอดเงินมัดจำคืนสุทธิ: <span className="text-xl">฿{thb(settlementPreview.refundAmount)}</span></div>
                    ) : (
                      <div>💳 ผู้เช่าต้องชำระเพิ่มสุทธิ: <span className="text-xl">฿{thb(settlementPreview.additionalPayAmount)}</span></div>
                    )}
                  </div>
                </div>
              )}

              {moveOutErrorMsg && <div className="bg-red-950/50 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-400">⚠️ {moveOutErrorMsg}</div>}

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setMoveOutRoom(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-sm font-bold">ยกเลิก</button>
                <button
                  type="button"
                  onClick={handleMoveOutConfirm}
                  disabled={!settlementPreview || executingMoveOut}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-[4px_4px_0_0_#be123c] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executingMoveOut ? 'กำลังบันทึกย้ายออก…' : '🔴 ยืนยันย้ายออก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
