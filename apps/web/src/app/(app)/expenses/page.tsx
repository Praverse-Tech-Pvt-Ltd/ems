'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Expense } from '@/types';
import { DollarSign, Clock, CheckCircle, Coffee, Car, Plane, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  FOOD:      Coffee,
  TRAVEL:    Car,
  FLIGHT:    Plane,
  EQUIPMENT: Briefcase,
  DEFAULT:   DollarSign,
};
const CATEGORY_COLORS: Record<string, string> = {
  FOOD:      'bg-brutal-yellow',
  TRAVEL:    'bg-brutal-blue',
  FLIGHT:    'bg-brutal-ink',
  EQUIPMENT: 'bg-brutal-red',
  DEFAULT:   'bg-brutal-surface',
};
const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-brutal-yellow border-brutal-ink text-brutal-ink',
  APPROVED: 'bg-brutal-blue border-brutal-ink text-white',
  REJECTED: 'bg-brutal-red border-brutal-ink text-white',
};

const FILTERS = ['All', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'] as const;
type Filter = typeof FILTERS[number];

export default function ExpensesPage() {
  const [filter, setFilter]   = useState<Filter>('All');
  const [page, setPage]       = useState(1);
  const PAGE_SIZE = 8;
  const qc = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => apiClient.get('/expenses').then((r) => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/expenses', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const filtered = filter === 'All' ? expenses : expenses.filter((e) => (e.status as string) === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const total    = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const pending  = expenses.filter((e) => e.status === 'SUBMITTED').reduce((s, e) => s + (e.amount ?? 0), 0);
  const approved = expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Expense<br />
            <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Tracker</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Submit and track your expense claims
          </p>
        </div>
        <button
          onClick={() => submitMutation.mutate({ category: 'MISC', amount: 0, description: 'New Expense', expenseDate: new Date().toISOString().split('T')[0] })}
          className="brutal-btn-primary px-6 py-4 text-sm"
        >
          + New Expense
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: DollarSign, label: 'Total Submitted', value: formatCurrency(total),    accent: undefined },
          { icon: Clock,      label: 'Pending Amount',  value: formatCurrency(pending),   accent: 'yellow' as const },
          { icon: CheckCircle,label: 'Approved Amount', value: formatCurrency(approved),  accent: 'blue' as const },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
              accent === 'yellow' ? 'bg-brutal-yellow' :
              accent === 'blue'   ? 'bg-brutal-blue'   : 'bg-brutal-white'
            }`}
          >
            <div className="w-11 h-11 bg-brutal-ink text-brutal-yellow flex items-center justify-center flex-shrink-0">
              <Icon size={18} />
            </div>
            <div>
              <p className={`text-xs font-display font-bold uppercase tracking-widest ${accent === 'blue' ? 'text-white/80' : 'text-[#4a4a4a]'}`}>{label}</p>
              <p className={`font-display font-bold text-xl ${accent === 'blue' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className="brutal-pill"
            data-active={filter === f}
          >
            {f === 'All' ? 'All Expenses' : f === 'SUBMITTED' ? 'Submitted' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-brutal-surface animate-pulse brutal-border" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="bg-brutal-white brutal-border brutal-shadow p-12 text-center">
          <p className="font-display font-bold uppercase text-[#4a4a4a]">No expenses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {paginated.map((e) => {
            const Icon = (CATEGORY_ICONS[e.category] ?? CATEGORY_ICONS.DEFAULT) as React.ElementType;
            const iconBg = CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.DEFAULT;
            return (
              <div key={e.id} className="bg-brutal-white brutal-border brutal-shadow p-5 flex flex-col gap-3 group hover:-translate-y-0.5 hover:brutal-shadow-lg transition-transform">
                <div className={`w-10 h-10 flex items-center justify-center ${iconBg} ${iconBg === 'bg-brutal-yellow' ? 'text-brutal-ink' : 'text-white'}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-display font-bold text-xs uppercase tracking-widest text-[#4a4a4a]">{e.category}</p>
                  <p className="font-display font-bold text-2xl text-brutal-ink">{formatCurrency(e.amount)}</p>
                  <p className="font-body text-xs text-[#4a4a4a] mt-1">{e.description ?? '—'}</p>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-body text-xs text-[#4a4a4a]">{formatDate(e.expenseDate)}</span>
                  <span className={`px-2 py-0.5 text-xs font-display font-bold uppercase border-2 ${
                    STATUS_STYLE[e.status] ?? 'bg-brutal-surface border-brutal-ink'
                  }`}>
                    {e.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between brutal-border-t pt-4">
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
  );
}
