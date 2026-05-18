'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { LeaveRequest, LeaveBalance } from '@/types';
import { Calendar, ChevronRight, Plus } from 'lucide-react';

const LEAVE_BALANCES_STATIC = [
  { code: 'CL', label: 'CASUAL',    avail: 6,  used: 6,  total: 12, bg: 'bg-brutal-yellow text-brutal-ink' },
  { code: 'SL', label: 'SICK',      avail: 8,  used: 4,  total: 12, bg: 'bg-brutal-red text-white' },
  { code: 'PL', label: 'PRIVILEGE', avail: 14, used: 1,  total: 15, bg: 'bg-brutal-blue text-white' },
  { code: 'UL', label: 'UNPAID',    avail: 0,  used: 0,  total: 0,  bg: 'bg-brutal-surface text-brutal-ink' },
  { code: 'CO', label: 'COMP-OFF',  avail: 2,  used: 1,  total: 3,  bg: 'bg-brutal-ink text-brutal-yellow' },
];

const LEAVE_HISTORY_STATIC = [
  { id: 'LV-2026-041', type: 'SICK',      from: '17 MAY', to: '17 MAY', days: 1, reason: 'Self-certified · viral',  status: 'PENDING',  tone: 'hold' },
  { id: 'LV-2026-038', type: 'CASUAL',    from: '02 MAY', to: '03 MAY', days: 2, reason: 'Family event · Pune',     status: 'APPROVED', tone: 'ok'   },
  { id: 'LV-2026-029', type: 'PRIVILEGE', from: '11 APR', to: '15 APR', days: 5, reason: 'Annual break · Goa',      status: 'APPROVED', tone: 'ok'   },
  { id: 'LV-2026-021', type: 'SICK',      from: '21 MAR', to: '21 MAR', days: 1, reason: 'Migraine',                status: 'APPROVED', tone: 'ok'   },
  { id: 'LV-2026-011', type: 'CASUAL',    from: '14 FEB', to: '14 FEB', days: 1, reason: 'Personal',                status: 'REJECTED', tone: 'red'  },
];

const TONE: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
};

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE[tone] ?? 'bg-brutal-surface text-brutal-ink'}`}>
      {children}
    </span>
  );
}

export default function LeavesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'CL', fromDate: '', toDate: '', reason: '' });

  const { data: apiLeaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leaves'],
    queryFn: () => apiClient.get('/leaves').then(r => r.data).catch(() => []),
  });
  const { data: apiBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances'],
    queryFn: () => apiClient.get('/leaves/balance').then(r => r.data).catch(() => []),
  });

  const applyMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/leaves', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setShowForm(false); },
  });

  const total = LEAVE_BALANCES_STATIC.reduce((s, b) => s + b.avail, 0);
  const history = apiLeaves.length > 0 ? [] : LEAVE_HISTORY_STATIC;

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— LEAVES / 03 · FY 2026</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-yellow px-2">{total}</span> DAYS LEFT<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">BALANCE EXPIRES 30 JUN · POLICY HR-22</div>
        </div>
        <div className="flex items-center gap-3">
          <button className="brutal-btn-secondary px-5 py-3 text-[13px] flex items-center gap-2">
            <Calendar size={14} /> TEAM CALENDAR
          </button>
          <button onClick={() => setShowForm(v => !v)} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
            <Plus size={15} /> REQUEST LEAVE
          </button>
        </div>
      </div>

      {/* Balance grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 brutal-border brutal-shadow">
        {LEAVE_BALANCES_STATIC.map((b, i) => (
          <div
            key={b.code}
            className={`p-5 ${i < 4 ? 'md:brutal-border-r' : ''} ${i < 3 ? 'brutal-border-b md:border-b-0' : ''} ${b.bg}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em]">{b.label}</span>
              <span className="font-display font-bold text-[10px] tracking-[0.16em] opacity-70">{b.code}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[32px] sm:text-[40px] lg:text-[44px] leading-[0.9] font-bold num">{b.avail}</span>
              <span className="font-display font-bold text-[12px] opacity-70">/ {b.total}</span>
            </div>
            <div className="mt-3 h-2 border-2 border-black/30 bg-black/10">
              <div className="h-full bg-black/40" style={{ width: `${b.total ? (b.used / b.total) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em] opacity-80">USED {b.used} · LEFT {b.avail}</div>
          </div>
        ))}
      </div>

      {/* Apply form */}
      {showForm && (
        <div className="brutal-border brutal-shadow bg-brutal-cream p-6 space-y-4">
          <div className="font-display font-bold text-[11px] tracking-[0.22em] brutal-border-b pb-3">— APPLY FOR LEAVE</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">LEAVE TYPE</label>
              <select
                value={form.leaveType}
                onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[13px] focus:outline-none"
              >
                {['CL', 'SL', 'PL', 'UL', 'CO'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">FROM DATE</label>
              <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold focus:outline-none" />
            </div>
            <div>
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">TO DATE</label>
              <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">REASON</label>
              <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[13px] focus:outline-none resize-none"
                placeholder="Briefly describe your reason..." />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => applyMutation.mutate(form)}
              disabled={applyMutation.isPending || !form.fromDate || !form.toDate}
              className="brutal-btn-primary px-5 py-3 text-[13px] disabled:opacity-60"
            >
              {applyMutation.isPending ? 'SUBMITTING…' : 'SUBMIT REQUEST'}
            </button>
            <button onClick={() => setShowForm(false)} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
          </div>
        </div>
      )}

      {/* Year calendar strip */}
      <div className="brutal-border brutal-shadow">
        <div className="px-4 py-2 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center justify-between">
          <span className="font-display font-bold text-[11px] tracking-[0.22em]">LEAVE CALENDAR · 2026</span>
          <span className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-cream/70">12 MONTHS · YOUR TEAM</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-12 gap-1.5">
            {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, mi) => (
              <div key={mi}>
                <div className="font-display font-bold text-[10px] tracking-[0.18em] text-center mb-1">{m}</div>
                <div className="grid grid-cols-1 gap-[2px]">
                  {Array.from({ length: 28 }).map((_, di) => {
                    const seed = (mi * 7 + di) % 17;
                    const cls = seed === 3 ? 'bg-brutal-yellow' : seed === 8 ? 'bg-brutal-blue' : seed === 13 ? 'bg-brutal-red' : 'bg-brutal-surface';
                    return <div key={di} className={`h-1.5 border border-brutal-ink/20 ${cls}`} />;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 flex-wrap font-display font-bold text-[10px] tracking-[0.16em]">
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-brutal-yellow border-2 border-brutal-ink" /> CASUAL / SICK</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-brutal-blue border-2 border-brutal-ink" /> PRIVILEGE</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-brutal-red border-2 border-brutal-ink" /> TEAM ON LEAVE</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-brutal-surface border-2 border-brutal-ink" /> WORKING DAY</span>
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="font-display font-bold text-[11px] tracking-[0.22em] text-brutal-ink/60 mb-3">— REQUEST HISTORY</div>
        <div className="space-y-3">
          {history.map((l, i) => (
            <div
              key={l.id}
              style={{ animationDelay: `${i * 30}ms` }}
              className="animate-fade-up grid grid-cols-12 items-stretch brutal-border brutal-shadow-sm"
            >
              <div className="col-span-2 sm:col-span-1 bg-brutal-ink text-brutal-yellow grid place-items-center font-display font-bold text-[10px] tracking-[0.16em] py-3">
                {l.type.slice(0, 2)}
              </div>
              <div className="col-span-10 sm:col-span-4 px-5 py-3 brutal-border-l flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{l.id}</span>
                  <span className="w-1 h-1 bg-brutal-ink" />
                  <span className="font-display font-bold text-[14px] tracking-tight">{l.type}</span>
                </div>
                <div className="font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/60 mt-0.5">{l.reason}</div>
              </div>
              <div className="col-span-6 sm:col-span-3 px-5 py-3 brutal-border-l flex flex-col justify-center">
                <div className="font-display font-bold text-[9px] tracking-[0.18em] text-brutal-ink/60">DATES</div>
                <div className="num font-display font-bold text-[13px] tracking-tight">{l.from} → {l.to}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 px-3 py-3 brutal-border-l flex flex-col items-center justify-center">
                <div className="text-[26px] font-bold num leading-none">{l.days}</div>
                <div className="font-display font-bold text-[9px] tracking-[0.16em] text-brutal-ink/60">DAY{l.days > 1 ? 'S' : ''}</div>
              </div>
              <div className="col-span-4 sm:col-span-3 px-3 py-3 brutal-border-l flex items-center justify-end gap-2">
                <Tag tone={l.tone}>{l.status}</Tag>
                <button className="w-8 h-8 grid place-items-center border-[3px] border-brutal-ink hover:bg-brutal-yellow transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
