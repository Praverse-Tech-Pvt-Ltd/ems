'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { LeaveRequest, LeaveBalance } from '@/types';
import { Calendar, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const LEAVE_COLORS: Record<string, string> = {
  ANNUAL:   'bg-brutal-yellow',
  SICK:     'bg-brutal-red text-white',
  CASUAL:   'bg-brutal-blue text-white',
  MATERNITY:'bg-brutal-ink text-white',
  DEFAULT:  'bg-brutal-surface',
};
const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-brutal-yellow border-brutal-ink text-brutal-ink',
  APPROVED: 'bg-brutal-blue border-brutal-ink text-white',
  REJECTED: 'bg-brutal-red border-brutal-ink text-white',
};

const FILTERS = ['All', 'PENDING', 'APPROVED', 'REJECTED'] as const;
type Filter = typeof FILTERS[number];

export default function LeavesPage() {
  const [filter, setFilter]   = useState<Filter>('All');
  const [page, setPage]       = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'CL', fromDate: '', toDate: '', reason: '' });
  const PAGE_SIZE = 8;
  const qc = useQueryClient();

  const { data: leaves = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['leaves'],
    queryFn: () => apiClient.get('/leaves').then((r) => r.data),
  });

  const { data: balances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances'],
    queryFn: () => apiClient.get('/leaves/balance').then((r) => r.data),
  });

  const applyMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/leaves', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setShowForm(false); },
  });

  const filtered   = filter === 'All' ? leaves : leaves.filter((l) => l.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalLeaves  = leaves.length;
  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Leave<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Management</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Apply and track your leave requests
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="brutal-btn-primary px-6 py-4 text-sm">
          + Apply Leave
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Calendar,    label: 'Total Requests',  value: totalLeaves,   accent: undefined },
          { icon: Clock,       label: 'Pending',          value: pendingCount,  accent: 'yellow' as const },
          { icon: CheckCircle, label: 'Approved',         value: approvedCount, accent: 'blue' as const },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
            accent === 'yellow' ? 'bg-brutal-yellow' :
            accent === 'blue'   ? 'bg-brutal-blue'   : 'bg-brutal-white'
          }`}>
            <div className="w-11 h-11 bg-brutal-ink text-brutal-yellow flex items-center justify-center flex-shrink-0">
              <Icon size={18} />
            </div>
            <div>
              <p className={`text-xs font-display font-bold uppercase tracking-widest ${accent === 'blue' ? 'text-white/80' : 'text-[#4a4a4a]'}`}>{label}</p>
              <p className={`font-display font-bold text-2xl ${accent === 'blue' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Leave Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((b) => {
            const pct = b.totalDays ? Math.round((b.usedDays / b.totalDays) * 100) : 0;
            const colorClass = LEAVE_COLORS[b.leaveType] ?? LEAVE_COLORS.DEFAULT;
            return (
              <div key={b.leaveType} className="bg-brutal-white brutal-border brutal-shadow p-5">
                <div className={`inline-block px-2 py-0.5 text-xs font-display font-bold uppercase border-2 border-brutal-ink mb-3 ${colorClass}`}>
                  {b.leaveType}
                </div>
                <p className="font-display font-bold text-3xl text-brutal-ink">{b.totalDays - b.usedDays}</p>
                <p className="font-body text-xs text-[#4a4a4a] mb-3">days used of {b.totalDays}</p>
                <div className="w-full h-2.5 bg-brutal-surface border border-brutal-ink">
                  <div className="h-full bg-brutal-ink transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Form */}
      {showForm && (
        <div className="bg-brutal-white brutal-border brutal-shadow p-6 space-y-4">
          <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3">Apply for Leave</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest mb-1.5">Leave Type</label>
              <select
                value={form.leaveType}
                onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
                className="w-full brutal-border bg-brutal-cream px-3 py-2 font-body text-sm focus:outline-none"
              >
                {['CL', 'SL', 'PL', 'UL', 'CO'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest mb-1.5">From Date</label>
              <input
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                className="w-full brutal-border bg-brutal-cream px-3 py-2 font-body text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest mb-1.5">To Date</label>
              <input
                type="date"
                value={form.toDate}
                onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                className="w-full brutal-border bg-brutal-cream px-3 py-2 font-body text-sm focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-display font-bold text-xs uppercase tracking-widest mb-1.5">Reason</label>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full brutal-border bg-brutal-cream px-3 py-2 font-body text-sm focus:outline-none resize-none"
                placeholder="Describe your reason..."
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => applyMutation.mutate(form)}
              disabled={applyMutation.isPending || !form.fromDate || !form.toDate}
              className="brutal-btn-primary px-6 py-3 text-sm disabled:opacity-60"
            >
              {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button onClick={() => setShowForm(false)} className="brutal-btn-secondary px-6 py-3 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className="brutal-pill" data-active={filter === f}>
            {f === 'All' ? 'All Requests' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-brutal-white brutal-border brutal-shadow">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-brutal-surface animate-pulse" />)}
          </div>
        ) : paginated.length === 0 ? (
          <p className="px-6 py-10 text-center font-display font-bold uppercase text-[#4a4a4a]">No leave requests found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brutal-surface brutal-border-b">
                {['Type', 'From', 'To', 'Days', 'Reason', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold text-xs uppercase tracking-wide text-[#4a4a4a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((l, i) => (
                <tr key={l.id} className={`border-b-2 border-brutal-surface ${i % 2 === 0 ? '' : 'bg-brutal-surface-lo'}`}>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 text-xs font-display font-bold uppercase border-2 border-brutal-ink ${LEAVE_COLORS[l.leaveType] ?? LEAVE_COLORS.DEFAULT}`}>
                      {l.leaveType}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{formatDate(l.fromDate)}</td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{formatDate(l.toDate)}</td>
                  <td className="px-5 py-3 font-display font-bold">{l.totalDays}</td>
                  <td className="px-5 py-3 font-body text-xs text-[#4a4a4a] max-w-xs truncate">{l.reason ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 text-xs font-display font-bold uppercase border-2 ${STATUS_STYLE[l.status] ?? 'bg-brutal-surface border-brutal-ink'}`}>
                      {l.status === 'APPROVED' ? <CheckCircle size={10} className="inline mr-1" /> : l.status === 'REJECTED' ? <XCircle size={10} className="inline mr-1" /> : null}
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="px-6 py-4 brutal-border-t flex items-center justify-between">
            <span className="text-xs font-display font-bold uppercase text-[#4a4a4a]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 brutal-border hover:bg-brutal-yellow disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 brutal-border hover:bg-brutal-yellow disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
