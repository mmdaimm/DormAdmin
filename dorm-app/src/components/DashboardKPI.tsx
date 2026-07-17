'use client';

import { useEffect, useState } from 'react';

interface KpiData {
  occupancy: { totalRooms: number; occupiedRooms: number; occupancyRate: number };
  incomeTrend: { period: string; income: number }[];
}

const thb = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-slate-800 rounded mb-3" />
      <div className="h-7 w-32 bg-slate-800 rounded" />
    </div>
  );
}

export default function DashboardKPI() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/kpi');
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json);
        }
      } catch (err) {
        console.error('[DashboardKPI] Failed to load KPI:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!data) return null;

  const { occupancy, incomeTrend } = data;
  const latestIncome = incomeTrend[incomeTrend.length - 1]?.income ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-slate-900 border border-emerald-900/50 rounded-2xl p-5">
        <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">อัตราการเข้าพัก</h3>
        <p className="text-2xl font-bold text-emerald-400">
          {(occupancy.occupancyRate * 100).toFixed(0)}%
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {occupancy.occupiedRooms} / {occupancy.totalRooms} ห้อง
        </p>
      </div>

      <div className="bg-slate-900 border border-indigo-900/50 rounded-2xl p-5">
        <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">
          รายได้เดือนนี้ (ตามงวดบิล)
        </h3>
        <p className="text-2xl font-bold text-indigo-400">฿{thb(latestIncome)}</p>
        <p className="text-xs text-slate-500 mt-1">Accrual Basis — ไม่ใช่กระแสเงินสด</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:col-span-2 lg:col-span-2">
        <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3">
          แนวโน้มรายได้ 3 เดือนล่าสุด (ตามงวดบิล)
        </h3>
        <div className="flex items-end gap-3 h-16">
          {incomeTrend.map((point) => {
            const max = Math.max(...incomeTrend.map((p) => p.income), 1);
            const heightPct = (point.income / max) * 100;
            return (
              <div key={point.period} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-slate-800 rounded-t relative" style={{ height: '48px' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{point.period}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
