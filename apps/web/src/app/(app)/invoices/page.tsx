'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { invoicesService } from '@/lib/api/invoices';
import { useAuthStore } from '@/store/auth.store';

const FILTERS = ['All', 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'OVERDUE'] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const statusClass: Record<string, string> = {
  PENDING: 'bg-primary/10 text-primary border-primary/20',
  APPROVED: 'bg-secondary/10 text-secondary border-secondary/20',
  REJECTED: 'bg-error/10 text-error border-error/20',
  PAID: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  OVERDUE: 'bg-error/10 text-error border-error/20',
};

export default function InvoicesPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoicesService.list().catch(() => []);
      setInvoices(Array.isArray(data) ? data : data?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(inv => {
      const status = inv.status ?? 'PENDING';
      const matchesStatus = filter === 'All' || status === filter;
      const matchesSearch =
        !q ||
        String(inv.invoiceNumber ?? '').toLowerCase().includes(q) ||
        String(inv.partyName ?? '').toLowerCase().includes(q) ||
        String(inv.description ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [filter, invoices, search]);

  const totals = useMemo(() => {
    const sum = (status: string) =>
      invoices.filter(inv => inv.status === status).reduce((total, inv) => total + Number(inv.amount ?? 0), 0);
    return {
      paid: sum('PAID'),
      pending: sum('PENDING'),
      count: invoices.length,
      pendingCount: invoices.filter(inv => inv.status === 'PENDING').length,
    };
  }, [invoices]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-md text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">lock</span>
        <p className="text-on-surface-variant">Invoices are visible only to Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">description</span>
          FINANCE
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Invoices</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Invoices</h2>
            <p className="text-on-surface-variant mt-xs">Live invoice records only. No demo vendors are shown.</p>
          </div>
          <button onClick={load} className="border border-outline-variant/50 text-on-surface-variant font-label-caps text-label-caps px-4 py-2 rounded-full hover:bg-surface-container-low">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
        {[
          { label: 'Total Invoices', value: String(totals.count), icon: 'receipt_long', color: 'text-on-surface' },
          { label: 'Pending', value: String(totals.pendingCount), icon: 'pending_actions', color: 'text-primary' },
          { label: 'Pending Amount', value: fmt(totals.pending), icon: 'hourglass_top', color: 'text-primary' },
          { label: 'Paid Amount', value: fmt(totals.paid), icon: 'task_alt', color: 'text-tertiary' },
        ].map(card => (
          <div key={card.label} className="glass-card rounded-2xl p-md border border-outline-variant/30">
            <span className={`material-symbols-outlined ${card.color}`}>{card.icon}</span>
            <p className={`font-black text-xl mt-sm ${card.color}`}>{card.value}</p>
            <p className="text-body-sm text-on-surface-variant">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
        <div className="p-sm flex items-center gap-sm flex-wrap border-b border-outline-variant/20">
          <div className="flex gap-xs flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${filter === f ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant'}`}
              >
                {f === 'All' ? 'All' : f}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-xs border border-outline-variant/50 rounded-xl px-sm py-1.5 bg-surface-container-lowest min-w-[220px]">
            <Search size={13} className="text-on-surface-variant" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search live invoices" className="bg-transparent outline-none text-body-sm flex-1" />
          </div>
        </div>

        {loading ? (
          <div className="p-lg text-center text-on-surface-variant">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-lg text-center text-on-surface-variant">
            No live invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead className="bg-surface-container-low">
                <tr>
                  {['Invoice #', 'Party', 'Type', 'Amount', 'Due Date', 'Status', 'Submitted By'].map(h => (
                    <th key={h} className="px-sm py-2 text-left text-[10px] font-bold text-on-surface-variant tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-surface-container-low/50">
                    <td className="px-sm py-3 font-mono text-xs text-on-surface">{inv.invoiceNumber}</td>
                    <td className="px-sm py-3 text-body-sm text-on-surface">{inv.partyName}</td>
                    <td className="px-sm py-3 text-body-sm text-on-surface-variant">{inv.type}</td>
                    <td className="px-sm py-3 font-semibold text-on-surface">{fmt(Number(inv.amount ?? 0))}</td>
                    <td className="px-sm py-3 text-body-sm text-on-surface-variant">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                    <td className="px-sm py-3">
                      <span className={`chip border ${statusClass[inv.status] ?? 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>{inv.status}</span>
                    </td>
                    <td className="px-sm py-3 text-body-sm text-on-surface-variant">
                      {inv.submitter ? `${inv.submitter.firstName} ${inv.submitter.lastName}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
