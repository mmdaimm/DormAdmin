'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function InvoiceManagerPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Filter & Sort State
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, tenRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/tenants') // We assume this endpoint exists and returns { success: true, tenants: [...] }
      ]);
      const invData = await invRes.json();
      const tenData = await tenRes.json();

      if (invData.success) {
        setInvoices(invData.invoices);
      }
      if (tenData.success) {
        setTenants(tenData.tenants);
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
    setEditingId(invoice.invoiceId);
    setEditForm({ ...invoice });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Find the latest tenant for this room
      const roomTenants = tenants.filter(t => t.room_id === selectedRoom);
      if (roomTenants.length > 0) {
        // Sort by entryDate descending
        roomTenants.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
        const latestTenant = roomTenants[0];
        
        // Filter invoices to only show bills generated on or after the latest tenant's entry date
        result = result.filter(inv => {
          // Both period and entryDate can be compared nicely if period is YYYY-MM
          // entryDate is YYYY-MM-DD. So we can just compare the YYYY-MM prefix.
          const invMonth = inv.period; // YYYY-MM
          const tenantMonth = latestTenant.entryDate.substring(0, 7); // YYYY-MM
          return invMonth >= tenantMonth;
        });
      }
    }

    result.sort((a, b) => {
      if (sortOrder === 'DESC') {
        return b.period.localeCompare(a.period);
      } else {
        return a.period.localeCompare(b.period);
      }
    });

    return result;
  }, [invoices, tenants, selectedRoom, sortOrder]);


  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">📋 จัดการบิล (Invoice Manager)</h1>
            <p className="text-slate-400">ดูและแก้ไขข้อมูลบิลทั้งหมด</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700">
            กลับหน้าหลัก
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-400">เลือกห้อง:</label>
            <select 
              value={selectedRoom} 
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-indigo-500 outline-none"
            >
              <option value="ALL">ทั้งหมด (All Rooms)</option>
              {uniqueRooms.map(r => (
                <option key={r} value={r}>ห้อง {r} (ผู้เช่าล่าสุด)</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-400">เรียงตามเดือน:</label>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value as 'DESC' | 'ASC')}
              className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-indigo-500 outline-none"
            >
              <option value="DESC">ล่าสุดไปเก่าสุด (Newest First)</option>
              <option value="ASC">เก่าสุดไปล่าสุด (Oldest First)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="py-3 px-4 font-medium">งวด</th>
                <th className="py-3 px-4 font-medium">ห้อง</th>
                <th className="py-3 px-4 font-medium text-right">ไฟ (ยูนิต)</th>
                <th className="py-3 px-4 font-medium text-right">น้ำ (บาท)</th>
                <th className="py-3 px-4 font-medium text-right">ยอดค้างยกมา</th>
                <th className="py-3 px-4 font-medium text-right text-emerald-400">ยอดรวมสุทธิ</th>
                <th className="py-3 px-4 font-medium text-right">ยอดที่จ่ายแล้ว</th>
                <th className="py-3 px-4 font-medium text-center">สถานะ</th>
                <th className="py-3 px-4 font-medium text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedInvoices.map(inv => (
                <tr key={inv.invoiceId} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-white">{inv.period}</td>
                  <td className="py-3 px-4">{inv.roomId}</td>
                  <td className="py-3 px-4 text-right">{inv.currMeter - inv.prevMeter}</td>
                  <td className="py-3 px-4 text-right">{formatThB(inv.waterBill)}</td>
                  <td className="py-3 px-4 text-right text-rose-400">{formatThB(inv.arrears)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">{formatThB(inv.totalAmount + inv.arrears - (inv.creditApplied || 0))}</td>
                  
                  {editingId === inv.invoiceId ? (
                    <>
                      <td className="py-3 px-4">
                        <input type="number" value={editForm.paidAmount} onChange={e => setEditForm({...editForm, paidAmount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-right" />
                      </td>
                      <td className="py-3 px-4">
                        <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white">
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
                        <span className={`px-2 py-1 text-xs rounded-full border ${inv.status === 'PAID' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : inv.status === 'PARTIAL' ? 'bg-amber-900/30 text-amber-400 border-amber-800' : 'bg-rose-900/30 text-rose-400 border-rose-800'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEdit(inv)} className="text-indigo-400 hover:text-indigo-300 text-sm">
                          แก้ไข
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              
              {filteredAndSortedInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    ไม่พบบิลที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
