'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Invoice } from '@/types';
import { FileText, Clock, AlertTriangle, CheckCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  PAID:    'bg-brutal-yellow border-brutal-ink text-brutal-ink',
  PENDING: 'bg-brutal-surface border-brutal-ink text-brutal-ink',
  OVERDUE: 'bg-brutal-red border-brutal-ink text-white',
  DRAFT:   'bg-brutal-surface-hi border-brutal-ink text-brutal-ink',
};

const FILTERS = ['All', 'PENDING', 'PAID', 'OVERDUE', 'DRAFT'] as const;
type Filter = typeof FILTERS[number];

export default function InvoicesPage() {
  const [filter, setFilter]   = useState<Filter>('All');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 10;

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => apiClient.get('/invoices').then((r) => r.data),
  });

  const filtered = invoices.filter((inv) => {
    const matchFilter = filter === 'All' || inv.status === filter;
    const matchSearch = !search ||
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.partyName?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAmount  = invoices.reduce((s, i) => s + (i.amount ?? 0), 0);
  const paidAmount   = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + (i.amount ?? 0), 0);
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Invoice<br />
            <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Center</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Manage and track client invoices
          </p>
        </div>
        <button className="brutal-btn-primary px-6 py-4 text-sm">+ New Invoice</button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText,      label: 'Total Value',    value: formatCurrency(totalAmount), accent: undefined },
          { icon: CheckCircle,   label: 'Paid',           value: formatCurrency(paidAmount),  accent: 'yellow' as const },
          { icon: Clock,         label: 'Pending',        value: pendingCount,                 accent: undefined },
          { icon: AlertTriangle, label: 'Overdue',        value: overdueCount,                 accent: 'red' as const },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
            accent === 'yellow' ? 'bg-brutal-yellow' :
            accent === 'red'    ? 'bg-brutal-red'    : 'bg-brutal-white'
          }`}>
            <div className="w-11 h-11 bg-brutal-ink text-brutal-yellow flex items-center justify-center flex-shrink-0">
              <Icon size={18} />
            </div>
            <div>
              <p className={`text-xs font-display font-bold uppercase tracking-widest ${accent === 'red' ? 'text-white/80' : 'text-[#4a4a4a]'}`}>{label}</p>
              <p className={`font-display font-bold text-xl ${accent === 'red' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} className="brutal-pill" data-active={filter === f}>
              {f === 'All' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" size={13} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice or client..."
            className="pl-9 pr-4 py-2 text-sm brutal-border bg-brutal-cream focus:outline-none font-body w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-brutal-white brutal-border brutal-shadow">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-brutal-surface animate-pulse" />)}
          </div>
        ) : paginated.length === 0 ? (
          <p className="px-6 py-10 text-center font-display font-bold uppercase text-[#4a4a4a]">No invoices found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brutal-surface brutal-border-b">
                {['Invoice #', 'Party', 'Amount', 'Due Date', 'Type', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold text-xs uppercase tracking-wide text-[#4a4a4a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((inv, i) => (
                <tr key={inv.id} className={`border-b-2 border-brutal-surface ${
                  inv.status === 'OVERDUE' ? 'bg-brutal-red/5' : i % 2 !== 0 ? 'bg-brutal-surface-lo' : ''
                }`}>
                  <td className="px-5 py-3 font-display font-bold uppercase text-xs">{inv.invoiceNumber ?? '—'}</td>
                  <td className="px-5 py-3 font-body text-brutal-ink font-bold">{inv.partyName ?? '—'}</td>
                  <td className="px-5 py-3 font-display font-bold">{formatCurrency(inv.amount)}</td>
                  <td className={`px-5 py-3 font-body ${inv.status === 'OVERDUE' ? 'text-brutal-red font-bold' : 'text-[#4a4a4a]'}`}>
                    {formatDate(inv.dueDate)}
                  </td>
                  <td className="px-5 py-3 font-body text-xs text-[#4a4a4a] uppercase">{inv.type}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 text-xs font-display font-bold uppercase border-2 ${STATUS_STYLE[inv.status] ?? 'bg-brutal-surface border-brutal-ink'}`}>
                      {inv.status}
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
