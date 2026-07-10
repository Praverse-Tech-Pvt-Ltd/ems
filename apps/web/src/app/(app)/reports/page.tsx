'use client';

import { useState } from 'react';
import { Download, TrendingUp, TrendingDown, FileText, BarChart2, Users, Calendar, DollarSign, Clock } from 'lucide-react';

/* ── Mock data ─────────────────────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const ATTENDANCE_DATA = [94, 91, 96, 88, 93, 97];
const EXPENSE_DATA    = [1.2, 1.8, 1.4, 2.1, 1.6, 1.9]; // in lakhs
const PAYROLL_DATA    = [48.2, 48.5, 49.1, 49.0, 49.8, 50.2]; // in lakhs

const REPORT_TYPES = [
  {
    id: 'attendance',
    title: 'Attendance Summary',
    desc: 'Monthly attendance rate, leaves taken, late arrivals, and absenteeism breakdown.',
    icon: 'fingerprint',
    accent: '#01677d',
    badge: 'bg-secondary/10 text-secondary border-secondary/20',
    count: '47 employees',
    last: 'Generated today',
  },
  {
    id: 'expense',
    title: 'Expense Report',
    desc: 'Department-wise expense claims, approvals, reimbursements, and budget utilisation.',
    icon: 'receipt_long',
    accent: '#aa3000',
    badge: 'bg-primary/10 text-primary border-primary/20',
    count: '₹1.9L this month',
    last: 'Generated Jun 5',
  },
  {
    id: 'payroll',
    title: 'Payroll Insights',
    desc: 'Gross, net, deductions, and salary disbursement trends across all departments.',
    icon: 'payments',
    accent: '#059669',
    badge: 'bg-success/10 text-success border-success/20',
    count: '₹50.2L this month',
    last: 'Generated Jun 1',
  },
  {
    id: 'leave',
    title: 'Leave Analysis',
    desc: 'Leave utilisation per type (PL, CL, SL), carry-forward balances, and trends.',
    icon: 'event_available',
    accent: '#7c4dff',
    badge: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    count: '12 on leave today',
    last: 'Generated Jun 7',
  },
  {
    id: 'headcount',
    title: 'Headcount Report',
    desc: 'Department strength, new joinings, exits, and current headcount by role.',
    icon: 'group',
    accent: '#e65100',
    badge: 'bg-error/10 text-error border-error/20',
    count: '47 active',
    last: 'Generated Jun 3',
  },
  {
    id: 'performance',
    title: 'Performance Overview',
    desc: 'KPI achievement rates, review completion, and goal progress across teams.',
    icon: 'leaderboard',
    accent: '#01677d',
    badge: 'bg-secondary/10 text-secondary border-secondary/20',
    count: 'Q2 2025',
    last: 'Generated May 31',
  },
];

const RECENT_EXPORTS = [
  { name: 'Attendance_May_2025.xlsx', type: 'Attendance', size: '42 KB', date: 'Jun 5, 2025', icon: 'fingerprint', accent: '#01677d' },
  { name: 'Payroll_Q1_2025.pdf', type: 'Payroll', size: '1.2 MB', date: 'Apr 2, 2025', icon: 'payments', accent: '#059669' },
  { name: 'Expense_Apr_2025.csv', type: 'Expense', size: '18 KB', date: 'May 3, 2025', icon: 'receipt_long', accent: '#aa3000' },
  { name: 'Leave_Analysis_Q1.pdf', type: 'Leave', size: '680 KB', date: 'Apr 5, 2025', icon: 'event_available', accent: '#7c4dff' },
];

/* ── Mini bar chart ────────────────────────────────────────────────── */
function MiniBar({
  data, max, color, unit, suffix,
}: {
  data: number[]; max: number; color: string; unit?: string; suffix?: string;
}) {
  return (
    <div className="flex items-end gap-1 h-14">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-sm transition-opacity"
            style={{
              height: `${(v / max) * 100}%`,
              background: `${color}`,
              opacity: i === data.length - 1 ? 1 : 0.35 + (i / (data.length - 1)) * 0.5,
            }}
            title={`${MONTHS[i]}: ${v}${suffix ?? ''}`}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Trend card ────────────────────────────────────────────────────── */
function TrendCard({
  title, value, sub, icon, accent, data, max, up, delta, unit, suffix,
}: {
  title: string; value: string; sub: string; icon: React.ReactNode; accent: string;
  data: number[]; max: number; up: boolean; delta: string; unit?: string; suffix?: string;
}) {
  return (
    <div
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 card-hover"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}14` }}
        >
          {icon}
        </div>
        <div
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {delta}
        </div>
      </div>
      <div>
        <div className="text-[24px] font-bold text-on-surface leading-none tracking-tight">
          {value}
        </div>
        <div className="text-[12px] text-on-surface-variant mt-1">{title}</div>
        <div className="text-[11px] text-on-surface-variant/55 mt-0.5">{sub}</div>
      </div>
      <MiniBar data={data} max={max} color={accent} unit={unit} suffix={suffix} />
      <div className="flex justify-between">
        {MONTHS.map(m => (
          <span key={m} className="text-[9.5px] text-on-surface-variant/40 font-medium text-center flex-1">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Report type card ──────────────────────────────────────────────── */
function ReportCard({
  title, desc, icon, accent, badge, count, last, onGenerate,
}: {
  title: string; desc: string; icon: string; accent: string; badge: string;
  count: string; last: string; onGenerate: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 card-hover group">
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}12`, boxShadow: `0 0 0 1px ${accent}25` }}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: accent, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <span className={`chip border text-[10.5px] mt-0.5 ${badge}`}>{count}</span>
      </div>

      <div className="flex-1">
        <h3 className="text-[14px] font-bold text-on-surface leading-snug">{title}</h3>
        <p className="text-[12px] text-on-surface-variant mt-1.5 leading-relaxed line-clamp-2">{desc}</p>
      </div>

      <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(226,191,181,0.3)' }}>
        <span className="text-[11px] text-on-surface-variant/55 font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {last}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors"
          >
            <Download size={11} />
            Export
          </button>
          <button
            onClick={onGenerate}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-on-primary transition-all active:scale-95"
            style={{ background: accent, boxShadow: `0 2px 8px ${accent}30` }}
          >
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-[22px] font-bold text-on-surface tracking-tight"
                style={{ letterSpacing: '-0.02em' }}
              >
                Reports
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                Attendance, payroll, and expense insights across your organisation
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {/* Period toggle */}
              <div
                className="flex w-full items-center gap-0.5 p-1 rounded-xl overflow-x-auto sm:w-auto"
                style={{ background: 'rgba(19,27,46,0.04)', border: '1px solid rgba(226,191,181,0.3)' }}
              >
                {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`min-h-11 flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold capitalize transition-all duration-150 whitespace-nowrap sm:flex-none sm:min-h-0 sm:py-1.5 ${
                      period === p
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <button
                className="flex min-h-11 items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-on-primary whitespace-nowrap sm:min-h-0"
                style={{
                  background: 'linear-gradient(135deg, #aa3000 0%, #c53800 100%)',
                  boxShadow: '0 2px 12px rgba(170,48,0,0.28)',
                }}
              >
                <Download size={14} />
                Export All
              </button>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Avg Attendance', value: '93.2%', icon: <Users size={16} style={{ color: '#01677d' }} />, accent: '#01677d', up: true, delta: '+1.4%' },
              { label: 'Total Expenses', value: '₹11.0L', icon: <DollarSign size={16} style={{ color: '#aa3000' }} />, accent: '#aa3000', up: false, delta: '-3.2%' },
              { label: 'Payroll Disbursed', value: '₹2.95 Cr', icon: <BarChart2 size={16} style={{ color: '#059669' }} />, accent: '#059669', up: true, delta: '+2.1%' },
              { label: 'Leaves Taken', value: '128 days', icon: <Calendar size={16} style={{ color: '#7c4dff' }} />, accent: '#7c4dff', up: false, delta: '+8 days' },
            ].map(s => (
              <div
                key={s.label}
                className="glass-card rounded-2xl px-3.5 py-3.5 sm:px-5 sm:py-4 flex min-h-[116px] flex-col items-start gap-3 sm:min-h-0 sm:flex-row sm:items-center card-hover"
                style={{ borderColor: `${s.accent}40` }}
              >
                <div className="flex w-full items-start justify-between gap-2 sm:w-auto sm:contents">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 sm:order-1"
                    style={{ background: `${s.accent}12` }}
                  >
                    {s.icon}
                  </div>
                  <div
                    className={`flex items-center gap-0.5 text-[10px] sm:text-[10.5px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 sm:order-3 sm:ml-auto ${
                      s.up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}
                  >
                    {s.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    <span className="whitespace-nowrap">{s.delta}</span>
                  </div>
                </div>
                <div className="min-w-0 sm:order-2">
                  <div className="text-[16px] min-[380px]:text-[17px] sm:text-[18px] font-bold text-on-surface leading-tight whitespace-nowrap tracking-tight">{s.value}</div>
                  <div className="text-[10.5px] sm:text-[11px] text-on-surface-variant mt-1 leading-tight">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TrendCard
              title="Average Attendance Rate" value="93.2%" sub="Last 6 months"
              icon={<Clock size={17} style={{ color: '#01677d' }} />}
              accent="#01677d" data={ATTENDANCE_DATA} max={100} up suffix="%"
              delta="+1.4% vs last period"
            />
            <TrendCard
              title="Expense Claims (₹L)" value="₹1.9L" sub="June 2025"
              icon={<FileText size={17} style={{ color: '#aa3000' }} />}
              accent="#aa3000" data={EXPENSE_DATA} max={2.5} up={false}
              delta="+18% vs May"
            />
            <TrendCard
              title="Payroll Disbursed (₹L)" value="₹50.2L" sub="June 2025"
              icon={<BarChart2 size={17} style={{ color: '#059669' }} />}
              accent="#059669" data={PAYROLL_DATA} max={55} up
              delta="+0.8% vs May"
            />
          </div>

          {/* Report type grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-on-surface tracking-tight">Generate Reports</h2>
              <span className="text-[12px] text-on-surface-variant/60 font-medium">
                {REPORT_TYPES.length} report types available
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORT_TYPES.map(r => (
                <ReportCard
                  key={r.id}
                  title={r.title}
                  desc={r.desc}
                  icon={r.icon}
                  accent={r.accent}
                  badge={r.badge}
                  count={r.count}
                  last={r.last}
                  onGenerate={() => {}}
                />
              ))}
            </div>
          </div>

          {/* Recent exports */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(226,191,181,0.25)' }}
            >
              <h2 className="text-[14px] font-bold text-on-surface">Recent Exports</h2>
              <button className="text-[12px] font-semibold text-secondary hover:underline">View all</button>
            </div>
            <div className="divide-y divide-card-border/40">
              {RECENT_EXPORTS.map((exp, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 group hover:bg-surface-container/50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${exp.accent}12` }}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ color: exp.accent, fontVariationSettings: "'FILL' 1" }}
                    >
                      {exp.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-on-surface truncate">{exp.name}</div>
                    <div className="text-[11px] text-on-surface-variant/60 mt-0.5">
                      {exp.type} · {exp.size} · {exp.date}
                    </div>
                  </div>
                  <button className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-secondary/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
