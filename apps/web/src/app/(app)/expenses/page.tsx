'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Expense } from '@/types';
import {
  Plane, Coffee, Receipt, Heart, CreditCard, Filter, Plus, ChevronRight,
} from 'lucide-react';

const REQUESTS_STATIC = [
  { id: 'INV-094', Icon: Plane,       type: 'TRAVEL EXPENSE',       detail: 'Hyderabad · Trial site visit',  amount: '₹ 28,450', date: '15 MAY', status: 'UNDER FINANCE REVIEW', tone: 'info'   },
  { id: 'INV-093', Icon: Coffee,      type: 'CLIENT HOSPITALITY',   detail: 'Investigator dinner — Apollo',  amount: '₹ 6,200',  date: '13 MAY', status: 'AWAITING MANAGER',     tone: 'hold'  },
  { id: 'INV-092', Icon: Receipt,     type: 'REAGENT REIMBURSEMENT',detail: 'Sigma-Aldrich · Lot 22B',       amount: '₹ 4,820',  date: '12 MAY', status: 'APPROVED',             tone: 'ok'    },
  { id: 'REQ-041', Icon: Heart,       type: 'SICK LEAVE',           detail: '1 day · self-certified',        amount: '17 MAY',    date: '11 MAY', status: 'PENDING',              tone: 'hold'  },
  { id: 'INV-091', Icon: CreditCard,  type: 'SOFTWARE SUBSCRIPTION',detail: 'GraphPad Prism · annual',       amount: '₹ 32,000', date: '08 MAY', status: 'APPROVED',             tone: 'ok'    },
  { id: 'REQ-039', Icon: Plane,       type: 'CONFERENCE TRAVEL',    detail: 'BioPharma Asia · Singapore',    amount: '$ 1,840',  date: '04 MAY', status: 'REJECTED',             tone: 'red'   },
  { id: 'INV-088', Icon: Coffee,      type: 'TEAM OFFSITE MEAL',    detail: 'Q1 closeout · 14 attendees',    amount: '₹ 9,400',  date: '29 APR', status: 'APPROVED',             tone: 'ok'    },
];

const FILTERS = ['ALL', 'AWAITING MANAGER', 'UNDER FINANCE REVIEW', 'APPROVED', 'REJECTED', 'PENDING'] as const;
type Filter = typeof FILTERS[number];

const ACCENT: Record<string, string> = {
  ok:   'bg-[#0F8F3A]',
  info: 'bg-brutal-blue',
  hold: 'bg-brutal-yellow',
  red:  'bg-brutal-red',
};
const TONE_TAG: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
};

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? 'bg-brutal-surface text-brutal-ink'}`}>
      {children}
    </span>
  );
}

export default function ExpensesPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const qc = useQueryClient();

  const { data: apiExpenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => apiClient.get('/expenses').then(r => r.data).catch(() => []),
  });

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/expenses', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const requests = REQUESTS_STATIC;
  const filtered = useMemo(() =>
    filter === 'ALL' ? requests : requests.filter(r => r.status === filter),
    [filter]
  );

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— EXPENSES & REQUESTS / 04</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            YOUR <span className="inline-block bg-brutal-blue text-white px-2">QUEUE</span><span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            {requests.length} ITEMS · YTD REIMBURSED ₹ 80,710
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="brutal-btn-secondary px-5 py-3 text-[13px] flex items-center gap-2">
            <Filter size={14} /> FILTERS
          </button>
          <button
            onClick={() => submitMutation.mutate({ category: 'MISC', amount: 0, description: 'New Expense', expenseDate: new Date().toISOString().split('T')[0] })}
            className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
          >
            <Plus size={15} /> SUBMIT NEW REQUEST
          </button>
        </div>
      </div>

      {/* Summary blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 brutal-border brutal-shadow">
        {[
          { l: 'IN FLIGHT',      v: '3',   s: 'AWAITING DECISION',  bg: 'bg-brutal-yellow' },
          { l: 'APPROVED · 30D', v: '4',   s: 'CLEARED BY FINANCE', bg: 'bg-[#0F8F3A] text-white' },
          { l: 'REJECTED · 30D', v: '1',   s: 'SEE REASON CODES',   bg: 'bg-brutal-red text-white' },
          { l: 'AVG CYCLE TIME', v: '2.4', s: 'DAYS · LAST QTR',    bg: 'bg-brutal-surface' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[32px] sm:text-[40px] lg:text-[44px] leading-[0.9] font-bold num">{s.v}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const active = filter === f;
          const count  = f === 'ALL' ? requests.length : requests.filter(r => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-display font-bold text-[11px] tracking-[0.16em] px-3 py-2 border-2 border-brutal-ink inline-flex items-center gap-2 transition-colors
                ${active ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'}`}
            >
              {f}
              <span className={`num text-[10px] px-1 ${active ? 'bg-brutal-yellow text-brutal-ink' : 'bg-brutal-ink text-brutal-cream'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((r, i) => (
          <div
            key={r.id}
            style={{ animationDelay: `${i * 30}ms` }}
            className="animate-fade-up grid grid-cols-12 items-stretch brutal-border brutal-shadow-sm hover:brutal-shadow hover:-translate-x-px hover:-translate-y-px transition-all"
          >
            <div className={`col-span-12 sm:col-span-1 ${ACCENT[r.tone] ?? 'bg-brutal-surface'} grid place-items-center sm:brutal-border-r brutal-border-b sm:border-b-0 py-3`}>
              <r.Icon size={18} className={r.tone === 'hold' ? 'text-brutal-ink' : 'text-white'} />
            </div>
            <div className="col-span-12 sm:col-span-5 px-5 py-3 sm:brutal-border-r flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{r.id}</span>
                <span className="w-1 h-1 bg-brutal-ink" />
                <span className="font-display font-bold text-[14px] tracking-tight">{r.type}</span>
              </div>
              <div className="font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/60 truncate mt-0.5">{r.detail}</div>
            </div>
            <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center">
              <span className="font-display font-bold text-[12px] tracking-[0.12em] num">{r.date}</span>
            </div>
            <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center justify-end">
              <span className="text-[17px] font-bold num tracking-tight">{r.amount}</span>
            </div>
            <div className="col-span-12 sm:col-span-2 px-3 py-3 flex items-center justify-end gap-2">
              <Tag tone={r.tone}>{r.status}</Tag>
              <button className="w-8 h-8 grid place-items-center border-[3px] border-brutal-ink hover:bg-brutal-yellow transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="brutal-border diag bg-brutal-cream p-12 text-center">
            <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
              NOTHING MATCHES THAT FILTER
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
