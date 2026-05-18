'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '@/types';

interface AttendanceDay {
  date: string;
  status: string;
}

interface ExpenseGroup {
  category: string;
  _sum: { amount: number | null };
  _count: number;
}

const CATEGORY_COLORS: Record<string, { label: string; c: string; hex: string }> = {
  TRAVEL:       { label: 'TRAVEL',       c: 'bg-brutal-yellow',  hex: '#ffa23a' },
  FOOD:         { label: 'FOOD',         c: 'bg-brutal-blue',    hex: '#0055ff' },
  OFFICE:       { label: 'OFFICE',       c: 'bg-brutal-ink',     hex: '#1a1a1a' },
  CLIENT_VISIT: { label: 'CLIENT VISIT', c: 'bg-brutal-red',     hex: '#e63b2e' },
  STATIONERY:   { label: 'STATIONERY',   c: 'bg-brutal-surface', hex: '#eee9e0' },
  HOTEL:        { label: 'HOTEL',        c: 'bg-brutal-yellow',  hex: '#ffa23a' },
  MISC:         { label: 'MISC',         c: 'bg-brutal-surface', hex: '#eee9e0' },
};

export default function ReportsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today      = now.toISOString().split('T')[0];
  const twoWeeksAgo = new Date(now.getTime() - 13 * 86400_000).toISOString().split('T')[0];

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['reports-dashboard'],
    queryFn: () => apiClient.get('/reports/dashboard').then(r => r.data).catch(() => null),
  });

  const { data: attendance = [] } = useQuery<AttendanceDay[]>({
    queryKey: ['reports-attendance', twoWeeksAgo, today],
    queryFn: () => apiClient.get(`/reports/attendance?from=${twoWeeksAgo}&to=${today}`).then(r => r.data).catch(() => []),
  });

  const { data: expenseGroups = [] } = useQuery<ExpenseGroup[]>({
    queryKey: ['reports-expenses', monthStart, today],
    queryFn: () => apiClient.get(`/reports/expenses?from=${monthStart}&to=${today}`).then(r => r.data).catch(() => []),
  });

  // Build 14-day attendance bar data
  const attendanceBars = useMemo(() => {
    const bars: number[] = [];
    for (let d = 0; d < 14; d++) {
      const date = new Date(now.getTime() - (13 - d) * 86400_000);
      const dateStr = date.toISOString().split('T')[0];
      const dayRecords = attendance.filter(r => r.date?.startsWith(dateStr ?? ''));
      if (dayRecords.length === 0) { bars.push(0); continue; }
      const present = dayRecords.filter(r => ['PRESENT', 'LATE', 'WFH'].includes(r.status)).length;
      bars.push(Math.round((present / dayRecords.length) * 100));
    }
    return bars;
  }, [attendance]);

  const avgAttendance = attendanceBars.filter(v => v > 0).reduce((s, v, _, a) => s + v / a.length, 0);
  const peakAttendance = Math.max(...attendanceBars.filter(v => v > 0), 0);
  const lowAttendance  = Math.min(...attendanceBars.filter(v => v > 0), 100);

  // Build expense pie data
  const pieData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const g of expenseGroups) {
      const existing = categoryMap.get(g.category) ?? 0;
      categoryMap.set(g.category, existing + (g._sum.amount ?? 0));
    }
    const total = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(categoryMap.entries())
      .map(([cat, amount]) => ({
        ...(CATEGORY_COLORS[cat] ?? { label: cat, c: 'bg-brutal-surface', hex: '#eee9e0' }),
        v: Math.round((amount / total) * 100),
        amount,
      }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
  }, [expenseGroups]);

  const totalExpenses = expenseGroups.reduce((s, g) => s + (g._sum.amount ?? 0), 0);

  // Build pie SVG paths
  let cumulative = 0;
  const paths = pieData.map(seg => {
    const start = cumulative;
    const end   = start + (seg.v / 100) * 360;
    const r = 48, cx = 50, cy = 50;
    const sx = cx + r * Math.cos(Math.PI * (start - 90) / 180);
    const sy = cy + r * Math.sin(Math.PI * (start - 90) / 180);
    const ex = cx + r * Math.cos(Math.PI * (end - 90) / 180);
    const ey = cy + r * Math.sin(Math.PI * (end - 90) / 180);
    const large = (end - start) > 180 ? 1 : 0;
    cumulative = end;
    return { ...seg, d: `M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey} Z` };
  });

  const openApprovals = (stats?.pendingLeaves ?? 0) + (stats?.pendingExpenses ?? 0);

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div>
        <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— REPORTS / 09</div>
        <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
          ORG <span className="inline-block bg-brutal-yellow px-2">DASHBOARDS</span><span className="text-brutal-red">.</span>
        </h1>
        <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
          LIVE DATA · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} IST
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 brutal-border brutal-shadow">
        {[
          { l: 'HEADCOUNT',      v: stats?.totalEmployees ?? '—',  s: 'ACTIVE EMPLOYEES', bg: 'bg-brutal-cream' },
          { l: 'PRESENT TODAY',  v: stats?.presentToday   ?? '—',  s: 'AS OF NOW',         bg: 'bg-brutal-yellow' },
          { l: 'OPEN APPROVALS', v: openApprovals || '—',          s: `${stats?.pendingLeaves ?? 0} LEAVES + ${stats?.pendingExpenses ?? 0} EXPENSES`, bg: 'bg-brutal-red text-white' },
          { l: 'MISSING PUNCH',  v: stats?.missingPunchOuts ?? '—', s: 'TODAY',            bg: 'bg-[#0F8F3A] text-white' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[28px] sm:text-[36px] lg:text-[40px] leading-[0.9] font-bold num">{String(s.v)}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance bar chart */}
        <div className="brutal-border brutal-shadow">
          <div className="px-4 py-2 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">ATTENDANCE · 14 DAYS</span>
            <span className="font-display font-bold text-[10px] tracking-[0.18em]">% PRESENT</span>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-44">
              {(attendanceBars.length > 0 ? attendanceBars : Array(14).fill(0)).map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full border-[2px] border-brutal-ink ${v === 0 ? 'diag bg-brutal-surface' : 'bg-brutal-ink'}`}
                    style={{ height: `${v > 85 ? (v - 85) * 7 : v > 0 ? 4 : 2}%`, minHeight: '6px' }}
                  />
                  <div className="font-display font-bold text-[8px] tracking-[0.1em] text-brutal-ink/50">{i + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="border-[3px] border-brutal-ink p-2">
                <div className="font-display font-bold text-[9px] tracking-[0.2em] text-brutal-ink/60">AVG</div>
                <div className="text-[18px] font-bold num">{avgAttendance > 0 ? `${avgAttendance.toFixed(1)}%` : '—'}</div>
              </div>
              <div className="border-[3px] border-brutal-ink p-2 bg-brutal-yellow">
                <div className="font-display font-bold text-[9px] tracking-[0.2em]">PEAK</div>
                <div className="text-[18px] font-bold num">{peakAttendance > 0 ? `${peakAttendance}%` : '—'}</div>
              </div>
              <div className="border-[3px] border-brutal-ink p-2 bg-brutal-red text-white">
                <div className="font-display font-bold text-[9px] tracking-[0.2em]">LOW</div>
                <div className="text-[18px] font-bold num">{lowAttendance < 100 ? `${lowAttendance}%` : '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense pie */}
        <div className="brutal-border brutal-shadow">
          <div className="px-4 py-2 brutal-border-b bg-brutal-blue text-white flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">EXPENSE MIX · MTD</span>
            <span className="font-display font-bold text-[10px] tracking-[0.18em]">
              {totalExpenses > 0 ? formatCurrency(totalExpenses) : '—'}
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-5 items-center justify-items-center sm:justify-items-start">
            {pieData.length > 0 ? (
              <>
                <svg viewBox="0 0 100 100" className="w-[140px] h-[140px]">
                  {paths.map((p, i) => (
                    <path key={i} d={p.d} fill={p.hex} stroke="#1a1a1a" strokeWidth="1.5" />
                  ))}
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#1a1a1a" strokeWidth="2" />
                </svg>
                <ul className="space-y-2">
                  {pieData.map(x => (
                    <li key={x.label} className="flex items-center gap-2 font-display font-bold text-[11px] tracking-[0.14em]">
                      <span className={`w-3 h-3 border-2 border-brutal-ink ${x.c}`} />
                      <span className="flex-1">{x.label}</span>
                      <span className="num text-brutal-ink/70">{x.v}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="col-span-2 py-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                NO EXPENSE DATA THIS MONTH
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
