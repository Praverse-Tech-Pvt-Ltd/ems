'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Invoice, InvoiceStatus } from '@/types';
import { ChevronRight, Plus } from 'lucide-react';

type Tab = 'ALL' | 'VENDOR' | 'CLIENT';

const TONE_TAG: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

function statusTone(s: InvoiceStatus): string {
  if (s === 'APPROVED' || s === 'PAID')       return 'ok';
  if (s === 'UNDER_REVIEW')                    return 'info';
  if (s === 'PENDING')                         return 'hold';
  if (s === 'OVERDUE' || s === 'REJECTED')     return 'red';
  return 'mute';
}

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? 'bg-brutal-surface text-brutal-ink'}`}>
      {children}
    </span>
  );
}

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('ALL');

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get('/invoices').then(r => r.data).catch(() => []),
  });

  const filtered = useMemo(() =>
    tab === 'ALL' ? invoices : invoices.filter(i => i.type === tab),
    [tab, invoices]
  );

  // Summary stats computed from live data
  const outstanding = useMemo(() => invoices.filter(i => i.status === 'PENDING' || i.status === 'UNDER_REVIEW'), [invoices]);
  const overdue     = useMemo(() => invoices.filter(i => i.status === 'OVERDUE'), [invoices]);
  const paid30      = useMemo(() => invoices.filter(i => i.status === 'PAID'), [invoices]);
  const outstandingAmount = outstanding.reduce((s, i) => s + i.amount, 0);
  const paid30Amount      = paid30.reduce((s, i) => s + i.amount, 0);

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
          { l: 'OUTSTANDING', v: outstandingAmount > 0 ? formatCurrency(outstandingAmount) : '₹0', s: `${outstanding.length} INVOICE${outstanding.length !== 1 ? 'S' : ''}`, bg: 'bg-brutal-yellow' },
          { l: 'OVERDUE',     v: String(overdue.length),     s: overdue.length > 0 ? 'NEEDS ATTENTION' : 'NONE',   bg: 'bg-brutal-red text-white' },
          { l: 'PAID · 30D',  v: String(paid30.length),      s: paid30Amount > 0 ? `${formatCurrency(paid30Amount)} CLEARED` : 'NONE', bg: 'bg-[#0F8F3A] text-white' },
          { l: 'TOTAL',       v: String(invoices.length),    s: 'ALL TIME',      bg: 'bg-brutal-surface' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[28px] sm:text-[36px] lg:text-[40px] leading-[0.9] font-bold num">{isLoading ? '—' : s.v}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'VENDOR', 'CLIENT'] as Tab[]).map(t => {
          const active = tab === t;
          const count = t === 'ALL' ? invoices.length : invoices.filter(x => x.type === t).length;
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
      {isLoading ? (
        <div className="brutal-border diag bg-brutal-cream p-12 text-center">
          <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
            LOADING INVOICES…
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => {
            const tone = statusTone(r.status);
            return (
              <div key={r.id} style={{ animationDelay: `${i * 30}ms` }}
                className="animate-fade-up grid grid-cols-12 items-stretch brutal-border brutal-shadow-sm">
                <div className={`col-span-12 sm:col-span-1 grid place-items-center sm:brutal-border-r brutal-border-b sm:border-b-0 font-display font-bold text-[10px] tracking-[0.18em] py-3
                  ${r.type === 'VENDOR' ? 'bg-brutal-blue text-white' : 'bg-brutal-yellow text-brutal-ink'}`}>
                  {r.type}
                </div>
                <div className="col-span-12 sm:col-span-5 px-5 py-3 sm:brutal-border-r flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{r.invoiceNumber}</span>
                    <span className="w-1 h-1 bg-brutal-ink" />
                    <span className="font-display font-bold text-[14px] tracking-tight">{r.partyName}</span>
                  </div>
                  <div className="font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/60 mt-0.5">
                    GST {r.gstPercent ?? 18}% · DUE {formatDate(r.dueDate).toUpperCase()}
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-3 px-5 py-3 sm:brutal-border-r flex items-center justify-end">
                  <span className="text-[20px] font-bold num tracking-tight">{formatCurrency(r.amount)}</span>
                </div>
                <div className="col-span-6 sm:col-span-3 px-3 py-3 flex items-center justify-end gap-2">
                  <Tag tone={tone}>{r.status.replace('_', ' ')}</Tag>
                  <button className="w-8 h-8 grid place-items-center border-[3px] border-brutal-ink hover:bg-brutal-yellow transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="brutal-border diag bg-brutal-cream p-12 text-center">
              <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
                NO INVOICES FOUND
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
