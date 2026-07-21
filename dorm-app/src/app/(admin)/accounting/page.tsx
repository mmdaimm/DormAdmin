'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function AccountingPage() {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, profit: 0, debt: 0 });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  // Form states
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState('MAINTENANCE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const sumRes = await fetch(`/api/accounting/summary?year=${selectedYear}`);
      const sumData = await sumRes.json();
      if (sumData.success) {
        setData(sumData.data);
        setTotals(sumData.totals);
      }

      const expRes = await fetch('/api/accounting/expenses');
      const expData = await expRes.json();
      if (expData.success) {
        setExpenses(expData.expenses);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, category, description, amount: Number(amount) }),
      });
      const resData = await res.json();
      if (resData.success) {
        setDescription('');
        setAmount('');
        await loadData();
      } else {
        setError(resData.error);
      }
    } catch (err) {
      setError('Failed to add expense');
    }
    setSubmitting(false);
  };

  const formatThB = (num: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="w-full flex flex-col gap-6 text-slate-300">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">📊 ระบบบัญชีหอพัก</h1>
            <p className="text-slate-400 mt-2">ภาพรวมรายได้ รายจ่าย และหนี้สินประจำปี</p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#1d1f27] border-2 border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none shadow-[2px_2px_0_0_#1d4aff] font-mono"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
              <option value="all">รวมทุกปี (All Years)</option>
            </select>
          </div>
        </div>

        {/* Totals Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border-2 border-slate-700 p-6 rounded-2xl shadow-[4px_4px_0_0_#22c55e]">
            <h3 className="text-slate-400 font-bold mb-1 font-mono">รายได้รวม (Income)</h3>
            <p className="text-4xl font-black text-green-500 font-mono tracking-tight">{formatThB(totals.income)}</p>
          </div>
          <div className="bg-slate-900 border-2 border-slate-700 p-6 rounded-2xl shadow-[4px_4px_0_0_#f33022]">
            <h3 className="text-slate-400 font-bold mb-1 font-mono">รายจ่ายรวม (Expense)</h3>
            <p className="text-4xl font-black text-red-500 font-mono tracking-tight">{formatThB(totals.expense)}</p>
          </div>
          <div className="bg-[#1d1f27] border-2 border-slate-600 p-6 rounded-2xl shadow-[4px_4px_0_0_#1d4aff]">
            <h3 className="text-slate-300 font-bold mb-1 font-mono">กำไรสุทธิ (Net Profit)</h3>
            <p className="text-4xl font-black text-blue-400 font-mono tracking-tight">{formatThB(totals.profit)}</p>
          </div>
          <div className="bg-slate-900 border-2 border-amber-900 p-6 rounded-2xl shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <h3 className="text-slate-400 text-sm uppercase tracking-wider mb-2">หนี้สินคงค้าง (Debt)</h3>
            <p className="text-3xl font-bold text-amber-500">{formatThB(totals.debt)}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-2xl h-[400px] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <h2 className="text-xl font-bold text-white mb-6">กราฟเปรียบเทียบรายรับ-รายจ่าย</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="income" name="รายรับ" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="รายจ่าย" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Form & Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-2xl h-fit shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <h2 className="text-xl font-bold text-white mb-4">เพิ่มรายจ่ายใหม่</h2>
            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">วันที่</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">หมวดหมู่</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 outline-none">
                  <option value="MAINTENANCE">ซ่อมบำรุง (Maintenance)</option>
                  <option value="UTILITY">ค่าน้ำ/ค่าไฟส่วนกลาง (Utility)</option>
                  <option value="OTHER">อื่นๆ (Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">รายละเอียด</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder="เช่น ซ่อมหลอดไฟ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">จำนวนเงิน (บาท)</label>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 outline-none" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-[#f33022] text-white border-2 border-[#b91c1c] shadow-[4px_4px_0_0_#7f1d1d] font-bold py-2.5 rounded-lg hover:bg-red-500 transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 disabled:shadow-none font-mono">
                {submitting ? 'กำลังบันทึก...' : 'บันทึกรายจ่าย'}
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-2xl lg:col-span-2 overflow-x-auto shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <h2 className="text-xl font-bold text-white mb-4">ประวัติรายจ่ายล่าสุด</h2>
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-sm">
                  <th className="py-3 px-4 font-medium">วันที่</th>
                  <th className="py-3 px-4 font-medium">หมวดหมู่</th>
                  <th className="py-3 px-4 font-medium">รายละเอียด</th>
                  <th className="py-3 px-4 font-medium text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">ยังไม่มีข้อมูลรายจ่าย</td></tr>
                ) : (
                  expenses.slice().reverse().map(exp => (
                    <tr key={exp.id} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                      <td className="py-3 px-4 text-slate-300">{exp.date}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-950 border border-slate-700 text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{exp.description}</td>
                      <td className="py-3 px-4 text-right text-rose-400">{formatThB(exp.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
