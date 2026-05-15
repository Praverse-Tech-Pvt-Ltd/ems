'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import { Clock, TrendingUp, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  PRESENT:    'bg-brutal-yellow text-brutal-ink',
  ABSENT:     'bg-brutal-red text-white',
  LATE:       'bg-brutal-blue text-white',
  HALF_DAY:   'bg-brutal-surface text-brutal-ink',
  LEAVE:      'bg-brutal-surface-hi text-brutal-ink',
};

const DAY_HEAT: Record<string, string> = {
  PRESENT:    'bg-brutal-yellow border-brutal-ink',
  ABSENT:     'bg-brutal-red border-brutal-ink',
  LATE:       'bg-brutal-blue border-brutal-ink',
  HALF_DAY:   'bg-brutal-surface-hi border-brutal-ink',
  LEAVE:      'bg-brutal-surface border-brutal-ink',
};

function HeatmapCell({ record }: { record?: AttendanceRecord }) {
  if (!record) return <div className="aspect-square border border-brutal-surface-hi bg-brutal-surface-hi" />;
  return (
    <div
      title={`${record.date}: ${record.status}`}
      className={`aspect-square border-2 cursor-default transition-transform hover:-translate-y-0.5 ${
        DAY_HEAT[record.status] ?? 'bg-brutal-surface border-brutal-ink'
      }`}
    />
  );
}

export default function AttendancePage() {
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const PAGE_SIZE = 10;

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance'],
    queryFn: () => apiClient.get('/attendance').then((r) => r.data),
  });

  const filtered = records.filter((r) =>
    !search || r.date.includes(search) || r.status.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalHours  = records.reduce((s, r) => s + (r.workingHours ?? 0), 0);
  const presentDays = records.filter((r) => r.status === 'PRESENT').length;
  const anomalies   = records.filter((r) => r.status === 'ABSENT' || r.status === 'LATE').length;
  const presenceRate = records.length ? Math.round((presentDays / records.length) * 100) : 0;

  // Build heatmap: last 35 days
  const heatDays = Array.from({ length: 35 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (34 - i));
    const dateStr = d.toISOString().split('T')[0];
    return records.find((r) => r.date === dateStr);
  });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Attendance<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Log</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Your presence and time records
          </p>
        </div>
        <a href="/attendance/biometric" className="brutal-btn-primary px-6 py-3 text-sm flex items-center gap-2">
          Punch In / Out
        </a>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Clock,         label: 'Total Hours',    value: `${totalHours.toFixed(1)}h` },
          { icon: TrendingUp,    label: 'Presence Rate',  value: `${presenceRate}%`,          accent: 'yellow' },
          { icon: AlertTriangle, label: 'Anomalies',      value: anomalies,                    accent: 'red' },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
              accent === 'yellow' ? 'bg-brutal-yellow' :
              accent === 'red'    ? 'bg-brutal-red'    : 'bg-brutal-white'
            }`}
          >
            <div className={`w-11 h-11 flex items-center justify-center flex-shrink-0 ${
              accent ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-ink text-brutal-yellow'
            }`}>
              <Icon size={18} />
            </div>
            <div>
              <p className={`text-xs font-display font-bold uppercase tracking-widest ${
                accent === 'red' ? 'text-white/80' : 'text-[#4a4a4a]'
              }`}>{label}</p>
              <p className={`font-display font-bold text-2xl ${
                accent === 'red' ? 'text-white' : 'text-brutal-ink'
              }`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="bg-brutal-white brutal-border brutal-shadow p-6">
        <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-5 brutal-border-b pb-3">
          Last 35 Days
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs font-display font-bold uppercase text-[#4a4a4a] pb-1">{d}</div>
          ))}
          {heatDays.map((r, i) => <HeatmapCell key={i} record={r} />)}
        </div>
        <div className="flex items-center gap-4 mt-4">
          {Object.entries({ PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', HALF_DAY: 'Half Day', LEAVE: 'Leave' }).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 border border-brutal-ink ${DAY_HEAT[k]?.split(' ')[0]}`} />
              <span className="text-xs font-display font-bold uppercase text-[#4a4a4a]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-brutal-white brutal-border brutal-shadow">
        <div className="px-6 py-4 brutal-border-b flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display font-bold text-lg uppercase tracking-tight">Attendance Records</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" size={13} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search date or status..."
              className="pl-9 pr-4 py-2 text-sm brutal-border bg-brutal-cream focus:outline-none focus:ring-0 font-body w-56"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-brutal-surface animate-pulse" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[#4a4a4a] font-bold uppercase text-center">No records found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="brutal-border-b text-xs text-[#4a4a4a] bg-brutal-surface">
                {['Date', 'Punch In', 'Punch Out', 'Hours', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={r.id} className={`border-b-2 border-brutal-surface ${i % 2 === 0 ? '' : 'bg-brutal-surface-lo'}`}>
                  <td className="px-5 py-3 font-display font-bold uppercase">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{r.punchInTime ?? '—'}</td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{r.punchOutTime ?? '—'}</td>
                  <td className="px-5 py-3 font-display font-bold">{r.workingHours != null ? `${r.workingHours}h` : '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 text-xs font-display font-bold uppercase border-2 border-brutal-ink ${
                      STATUS_STYLE[r.status] ?? 'bg-brutal-surface'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[#4a4a4a] font-body">
                    {r.isRegularized ? 'Regularized' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 brutal-border-t flex items-center justify-between">
            <span className="text-xs font-display font-bold uppercase text-[#4a4a4a]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 brutal-border hover:bg-brutal-yellow disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 brutal-border hover:bg-brutal-yellow disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
