'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Invoice } from '@/types';
import { ChevronRight, Plus } from 'lucide-react';

const INVOICES_STATIC = [
  { id: 'VINV-3091', kind: 'VENDOR', party: 'Sigma-Aldrich India', amount: '₹ 1,84,200', gst: '18%', due: '22 MAY', status: 'UNDER REVIEW', tone: 'info'   },
  { id: 'CINV-2048', kind: 'CLIENT', party: 'Apollo Hospitals',    amount: '₹ 12,40,000',gst: '18%', due: '30 MAY', status: 'PENDING',      tone: 'hold'  },
  { id: 'VINV-3088', kind: 'VENDOR', party: 'Thermo Fisher',       amount: '₹ 6,72,000', gst: '18%', due: '18 MAY', status: 'APPROVED',     tone: 'ok'    },
  { id: 'VINV-3082', kind: 'VENDOR', party: 'Promega',             amount: '₹ 88,400',   gst: '18%', due: '12 MAY', status: 'PAID',         tone: 'ok'    },
  { id: 'VINV-3079', kind: 'VENDOR', party: 'Eppendorf',           amount: '₹ 42,500',   gst: '18%', due: '08 MAY', status: 'OVERDUE',      tone: 'red'   },
  { id: 'CINV-2041', kind: 'CLIENT', party: 'Cipla Ltd.',          amount: '₹ 8,15,000', gst: '18%', due: '02 MAY', status: 'PAID',         tone: 'ok'    },
];

type Tab = 'ALL' | 'VENDOR' | 'CLIENT';

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

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('ALL');

  useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get('/invoices').then(r => r.data).catch(() => []),
  });

  const filtered = useMemo(() =>
    tab === 'ALL' ? INVOICES_STATIC : INVOICES_STATIC.filter(i => i.kind === tab),
    [tab]
  );

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— INVOICES / 08</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-blue text-white px-2">VENDOR + CLIENT</span><span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">GST · DUE DATES · PAYMENT REFS</div>
        </div>
        <button className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
          <Plus size={15} /> NEW INVOICE
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 brutal-border brutal-shadow">
        {[
          { l: 'OUTSTANDING', v: '₹ 14.2L', s: '2 INVOICES',      bg: 'bg-brutal-yellow' },
          { l: 'OVERDUE',     v: '1',        s: 'SEE EPPENDORF',   bg: 'bg-brutal-red text-white' },
          { l: 'PAID · 30D',  v: '3',        s: '₹ 21.8L CLEARED', bg: 'bg-[#0F8F3A] text-white' },
          { l: 'AVG TURN',    v: '8.1',      s: 'DAYS · LAST QTR', bg: 'bg-brutal-surface' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[28px] sm:text-[36px] lg:text-[40px] leading-[0.9] font-bold num">{s.v}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'VENDOR', 'CLIENT'] as Tab[]).map(t => {
          const active = tab === t;
          const count = t === 'ALL' ? INVOICES_STATIC.length : INVOICES_STATIC.filter(x => x.kind === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`font-display font-bold text-[11px] tracking-[0.16em] px-3 py-2 border-2 border-brutal-ink inline-flex items-center gap-2 transition-colors
                ${active ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'}`}>
              {t}
              <span className={`num text-[10px] px-1 ${active ? 'bg-brutal-yellow text-brutal-ink' : 'bg-brutal-ink text-brutal-cream'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((r, i) => (
          <div key={r.id} style={{ animationDelay: `${i * 30}ms` }}
            className="animate-fade-up grid grid-cols-12 items-stretch brutal-border brutal-shadow-sm">
            <div className={`col-span-12 sm:col-span-1 grid place-items-center sm:brutal-border-r brutal-border-b sm:border-b-0 font-display font-bold text-[10px] tracking-[0.18em] py-3
              ${r.kind === 'VENDOR' ? 'bg-brutal-blue text-white' : 'bg-brutal-yellow text-brutal-ink'}`}>
              {r.kind}
            </div>
            <div className="col-span-12 sm:col-span-5 px-5 py-3 sm:brutal-border-r flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{r.id}</span>
                <span className="w-1 h-1 bg-brutal-ink" />
                <span className="font-display font-bold text-[14px] tracking-tight">{r.party}</span>
              </div>
              <div className="font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/60 mt-0.5">GST {r.gst} · DUE {r.due}</div>
            </div>
            <div className="col-span-6 sm:col-span-3 px-5 py-3 sm:brutal-border-r flex items-center justify-end">
              <span className="text-[20px] font-bold num tracking-tight">{r.amount}</span>
            </div>
            <div className="col-span-6 sm:col-span-3 px-3 py-3 flex items-center justify-end gap-2">
              <Tag tone={r.tone}>{r.status}</Tag>
              <button className="w-8 h-8 grid place-items-center border-[3px] border-brutal-ink hover:bg-brutal-yellow transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
