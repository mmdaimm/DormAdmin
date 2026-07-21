'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { Role } from '@/types/auth';

interface InvoiceManagerClientProps {
  userRole: Role;
}

export default function InvoiceManagerClient({ userRole }: InvoiceManagerClientProps) {
  const canEdit = userRole === 'owner';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Filter & Sort State
  const currentYearStr = new Date().getFullYear().toString();
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  
  const yearOptions = ['ALL', currentYearStr, (Number(currentYearStr) - 1).toString(), (Number(currentYearStr) - 2).toString()];
  const monthOptions = Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0'));

  const handleExportCSV = () => {
    const headers = [
      'งวด', 'ห้อง', 'ไฟ(ยูนิต)', 'น้ำ(บาท)', 'ค่าห้อง', 'รวม(ห้อง+น้ำ+ไฟ)',
      'ยอดค้างยกมา', 'ยอดรวมสุทธิ', 'ยอดที่จ่ายแล้ว', 'สถานะ',
    ];

    const rows = filteredAndSortedInvoices.map((inv) => {
      const room = rooms.find((r) => r.roomId === inv.roomId);
      const baseRent = room?.monthlyRent ?? 0;
      const actualRent = baseRent - (inv.proratedAmount ?? 0);
      const grandTotal = inv.totalAmount + (inv.remainingArrears ?? 0) - (inv.creditApplied ?? 0);

      return [
        inv.period,
        room?.roomNumber || inv.roomId,
        inv.currMeter - inv.prevMeter,
        inv.waterBill,
        actualRent,
        inv.totalAmount,
        inv.remainingArrears ?? 0,
        grandTotal,
        inv.paidAmount ?? 0,
        inv.status,
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    // UTF-8 BOM so Excel opens Thai text correctly instead of garbling it.
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${selectedYear}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, tenRes, roomsRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/tenants'),
        fetch('/api/rooms')
      ]);
      const invData = await invRes.json();
      const tenData = await tenRes.json();
      const roomsData = await roomsRes.json();

      if (invData.success) {
        setInvoices(invData.invoices);
      }
      if (tenData.success) {
        setTenants(tenData.tenants);
      }
      if (roomsData.success) {
        setRooms(roomsData.rooms);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (invoice: any) => {
    if (!canEdit) return;
    setEditingId(invoice.invoiceId);
    setEditForm({ ...invoice });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('คุณไม่มีสิทธิ์แก้ไขบิล — เฉพาะ Owner เท่านั้นที่แก้ไขได้');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: editingId,
          status: editForm.status,
          paidAmount: Number(editForm.paidAmount)
        })
      });
      if (res.ok) {
        setEditingId(null);
        await fetchData();
      } else {
        alert('Failed to save invoice');
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const formatThB = (num: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);

  // Derive unique rooms from invoices
  const uniqueRooms = useMemo(() => {
    const rooms = new Set(invoices.map(inv => inv.roomId));
    return Array.from(rooms).sort();
  }, [invoices]);

  // Filter and Sort logic
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    if (selectedRoom !== 'ALL') {
      result = result.filter(inv => inv.roomId === selectedRoom);

      const roomTenants = tenants.filter(t => t.room_id === selectedRoom);
      if (roomTenants.length > 0) {
        roomTenants.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
        const latestTenant = roomTenants[0];
        
        result = result.filter(inv => {
          const invMonth = inv.period;
          const tenantMonth = latestTenant.entryDate.substring(0, 7);
          return invMonth >= tenantMonth;
        });
      }
    }

    if (selectedYear !== 'ALL') {
      result = result.filter(inv => inv.period.startsWith(selectedYear));
    }

    if (selectedMonth !== 'ALL') {
      result = result.filter(inv => inv.period.endsWith(`-${selectedMonth}`));
    }

    result.sort((a, b) => {
      if (sortOrder === 'DESC') {
        return b.period.localeCompare(a.period);
      } else {
        return a.period.localeCompare(b.period);
      }
    });

    return result;
  }, [invoices, tenants, selectedRoom, sortOrder, selectedYear, selectedMonth]);
  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-6 text-slate-300">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">📋 จัดการบิล (Invoice Manager)</h1>
        <p className="text-slate-400 mt-2">
          {canEdit ? 'ดูและแก้ไขข้อมูลบิลทั้งหมด' : 'ดูข้อมูลบิลทั้งหมด (สิทธิ์แก้ไขเฉพาะ Owner)'}
        </p>
      </header>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 p-4 rounded-xl border-2 border-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-400">เลือกห้อง:</label>
            <select 
              value={selectedRoom} 
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-emerald-500 outline-none"
            >
              <option value="ALL">ทั้งหมด (All Rooms)</option>
              {uniqueRooms.map(r => {
                const roomObj = rooms.find(room => room.roomId === r);
                return (
                  <option key={r} value={r}>ห้อง {roomObj?.roomNumber || r}</option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-400">ปี:</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-emerald-500 outline-none"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y === 'ALL' ? 'ทั้งหมด' : y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-400">เดือน:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-emerald-500 outline-none"
            >
              <option value="ALL">ทั้งหมด</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm font-medium text-slate-400">เรียง:</label>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value as 'DESC' | 'ASC')}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-emerald-500 outline-none"
            >
              <option value="DESC">ล่าสุดไปเก่าสุด (Newest First)</option>
              <option value="ASC">เก่าสุดไปล่าสุด (Oldest First)</option>
            </select>
          </div>

          <button onClick={handleExportCSV} disabled={invoices.length === 0}
            className="px-4 py-2 bg-[#1d1f27] hover:bg-slate-800 text-white border-2 border-slate-600 rounded-lg text-sm font-bold transition-all shadow-[4px_4px_0_0_#f7a501] disabled:opacity-50 disabled:shadow-none font-mono"
          >
            📥 Export CSV
          </button>
        </div>

        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-x-auto shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-sm divide-x divide-slate-800">
                <th className="py-4 px-4 font-medium sticky left-0 z-20 bg-slate-950">งวด</th>
                <th className="py-4 px-4 font-medium sticky left-[4.5rem] z-20 bg-slate-950">ห้อง</th>
                <th className="py-4 px-4 font-medium text-right">ไฟ (ยูนิต)</th>
                <th className="py-4 px-4 font-medium text-right">น้ำ (บาท)</th>
                <th className="py-4 px-4 font-medium text-right text-emerald-400">ค่าห้อง</th>
                <th className="py-4 px-4 font-medium text-right text-emerald-400">รวม(ห้อง+น้ำ+ไฟ)</th>
                <th className="py-4 px-4 font-medium text-right">ยอดค้างยกมา</th>
                <th className="py-4 px-4 font-medium text-right text-emerald-500">ยอดรวมสุทธิ</th>
                <th className="py-4 px-4 font-medium text-right">ยอดที่จ่ายแล้ว</th>
                <th className="py-4 px-4 font-medium text-center">สถานะ</th>
                <th className="py-4 px-4 font-medium text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAndSortedInvoices.map(inv => {
                const room = rooms.find(r => r.roomId === inv.roomId);
                const baseRent = room?.monthlyRent ?? 0;
                const actualRent = baseRent - (inv.proratedAmount ?? 0);
                
                let displayStatus = inv.status;
                let statusBadgeClasses = '';
                
                if (inv.status !== 'PAID') {
                  const isClearedLater = invoices.some(laterInv => {
                    if (laterInv.roomId !== inv.roomId || laterInv.period <= inv.period) return false;
                    const grandTotal = (laterInv.totalAmount ?? 0) + (laterInv.remainingArrears ?? 0) - (laterInv.creditApplied ?? 0);
                    return (laterInv.paidAmount ?? 0) >= grandTotal;
                  });
                  if (isClearedLater) {
                    displayStatus = 'CLEARED';
                  }
                }
                
                if (displayStatus === 'PAID') {
                  statusBadgeClasses = 'bg-green-500 text-black border-2 border-green-600 shadow-[2px_2px_0_0_#15803d] font-bold';
                } else if (displayStatus === 'CLEARED') {
                  statusBadgeClasses = 'bg-slate-800 text-white border-2 border-slate-700 font-bold';
                  displayStatus = 'ยกยอดไปแล้ว';
                } else if (displayStatus === 'PARTIAL' || (inv.status === 'UNPAID' && inv.paidAmount > 0)) {
                  statusBadgeClasses = 'bg-[#f7a501] text-black border-2 border-[#b77a00] shadow-[2px_2px_0_0_#78350f] font-bold';
                } else {
                  statusBadgeClasses = 'bg-[#f33022] text-white border-2 border-[#b91c1c] shadow-[2px_2px_0_0_#7f1d1d] font-bold';
                }
                
                return (
                <tr key={inv.invoiceId} className="group hover:bg-slate-800 transition-colors divide-x divide-slate-800">
                  <td className="py-4 px-4 font-medium text-white sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors">
                    {inv.period}
                    {inv.proratedAmount > 0 && <span className="ml-2 text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800">ส่วนลดแรกเข้า</span>}
                  </td>
                  <td className="py-4 px-4 sticky left-[4.5rem] z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors">{room?.roomNumber || inv.roomId}</td>
                  <td className="py-3 px-4 text-right">{inv.currMeter - inv.prevMeter}</td>
                  <td className="py-3 px-4 text-right">{formatThB(inv.waterBill)}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{formatThB(actualRent)}</td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-400">{formatThB(inv.totalAmount)}</td>
                  <td className="py-3 px-4 text-right text-rose-400">{formatThB(inv.remainingArrears ?? 0)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-500">{formatThB(inv.totalAmount + (inv.remainingArrears ?? 0) - (inv.creditApplied ?? 0))}</td>
                  
                  {canEdit && editingId === inv.invoiceId ? (
                    <>
                      <td className="py-3 px-4">
                        <input type="number" value={editForm.paidAmount} onChange={e => setEditForm({...editForm, paidAmount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-200 text-right focus:border-emerald-500 outline-none" />
                      </td>
                      <td className="py-3 px-4">
                        <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-slate-200 focus:border-emerald-500 outline-none">
                          <option value="UNPAID">UNPAID</option>
                          <option value="PARTIAL">PARTIAL</option>
                          <option value="PAID">PAID</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center space-x-2">
                        <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-300">บันทึก</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-300">ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-right text-emerald-400">{formatThB(inv.paidAmount || 0)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full border ${statusBadgeClasses}`} title={inv.status !== displayStatus ? `สถานะเดิม: ${inv.status}` : ''}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {canEdit ? (
                          <button onClick={() => handleEdit(inv)} className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                            แก้ไข
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs" title="เฉพาะ Owner เท่านั้นที่แก้ไขบิลได้">
                            🔒 ดูอย่างเดียว
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )})}
              
              {filteredAndSortedInvoices.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    ไม่พบบิลที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}
