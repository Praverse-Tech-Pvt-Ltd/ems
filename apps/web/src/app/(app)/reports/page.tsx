'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DashboardStats } from '@/types';
import { BarChart2, Users, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, FileText } from 'lucide-react';

const EXPENSE_MIX = [
  { label: 'TRAVEL',    pct: 42, color: 'bg-brutal-blue' },
  { label: 'FOOD',      pct: 21, color: 'bg-brutal-yellow' },
  { label: 'EQUIPMENT', pct: 18, color: 'bg-brutal-ink' },
  { label: 'CLIENT',    pct: 12, color: 'bg-brutal-red' },
  { label: 'OTHER',     pct: 7,  color: 'bg-brutal-surface-hi' },
];

const ATT_14D = [72, 85, 78, 91, 88, 76, 94, 82, 90, 87, 79, 93, 88, 95];

export default function ReportsPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn:  () => apiClient.get('/dashboard/stats').then((r) => r.data),
  });

  const maxBar = Math.max(...ATT_14D);

  return (
    <div className="space-y-8 max-w-6xl animate-fade-up">
      {/* Header */}
      <div>
        <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— REPORTS / 09</div>
        <h1 className="mt-2 font-display font-bold text-[44px] leading-[1.1] tracking-tight text-brutal-ink">
          ORG <span className="inline-block bg-brutal-blue text-white px-2">ANALYTICS</span>
          <span className="text-brutal-red">.</span>
        </h1>
        <div className="mt-2 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">LIVE DATA · MAY 2026</div>
      </div>

      {/* KPI strip */}
      <div className="brutal-border brutal-shadow bg-brutal-cream grid grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users,       label: 'TOTAL EMPLOYEES', value: stats?.totalEmployees   ?? '—', bg: 'bg-brutal-yellow' },
          { icon: CheckCircle, label: 'PRESENT TODAY',   value: stats?.presentToday     ?? '—', bg: 'bg-[#0F8F3A] text-white' },
          { icon: XCircle,     label: 'ABSENT TODAY',    value: stats?.absentToday      ?? '—', bg: 'bg-brutal-red text-white' },
          { icon: Clock,       label: 'MISSING PUNCH',   value: stats?.missingPunchOuts ?? '—', bg: 'bg-brutal-ink text-brutal-yellow' },
        ].map(({ icon: Icon, label, value, bg }, i) => (
          <div key={label} className={`p-5 ${i < 3 ? 'border-r-[3px] border-brutal-ink' : ''} ${bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} />
              <span className="font-display font-bold text-[10px] tracking-[0.22em]">{label}</span>
            </div>
            <div className="font-display font-bold text-[44px] leading-[0.9]">{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        {/* 14-day attendance bar chart */}
        <div className="brutal-border brutal-shadow bg-brutal-cream">
          <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">ATTENDANCE RATE · LAST 14 DAYS</span>
            <BarChart2 size={14} />
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-44">
              {ATT_14D.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="font-display font-bold text-[9px]">{v}</div>
                  <div className="w-full flex items-end flex-1">
                    <div
                      className={`w-full border-[2px] border-brutal-ink ${v >= 90 ? 'bg-brutal-yellow' : v >= 80 ? 'bg-brutal-blue text-white' : 'bg-brutal-red text-white'}`}
                      style={{ height: `${(v / maxBar) * 100}%`, minHeight: '8px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 brutal-border-t flex-wrap">
              {[{ label: '≥90% Excellent', color: 'bg-brutal-yellow' }, { label: '≥80% Good', color: 'bg-brutal-blue' }, { label: '<80% Low', color: 'bg-brutal-red' }].map((l) => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 border border-brutal-ink ${l.color}`} />
                  <span className="font-display font-bold text-[10px] tracking-widest">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense mix */}
        <div className="brutal-border brutal-shadow bg-brutal-cream">
          <div className="px-5 py-3 brutal-border-b bg-brutal-yellow flex items-center justify-between">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">EXPENSE MIX · YTD</span>
            <DollarSign size={14} />
          </div>
          <div className="p-5 space-y-4">
            {EXPENSE_MIX.map((e) => (
              <div key={e.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-display font-bold text-[11px] tracking-[0.16em]">{e.label}</span>
                  <span className="font-display font-bold text-[13px]">{e.pct}%</span>
                </div>
                <div className="w-full h-5 brutal-border bg-brutal-surface relative">
                  <div className={`h-full ${e.color}`} style={{ width: `${e.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign,  label: 'Pending Expenses', value: stats?.pendingExpenses ?? '—' },
          { icon: FileText,    label: 'Overdue Invoices',  value: stats?.overdueInvoices ?? '—', accent: 'red' },
          { icon: TrendingUp,  label: 'Pending Leaves',    value: stats?.pendingLeaves   ?? '—', accent: 'blue' },
          { icon: Clock,       label: 'On-Time Rate',      value: '91%',                         accent: 'yellow' },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
            accent === 'yellow' ? 'bg-brutal-yellow' :
            accent === 'red'    ? 'bg-brutal-red'    :
            accent === 'blue'   ? 'bg-brutal-blue'   : 'bg-brutal-cream'
          }`}>
            <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${accent ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-ink text-brutal-yellow'}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className={`font-display font-bold text-[10px] uppercase tracking-widest ${accent === 'blue' || accent === 'red' ? 'text-white/80' : 'text-brutal-ink/60'}`}>{label}</p>
              <p className={`font-display font-bold text-2xl ${accent === 'blue' || accent === 'red' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
