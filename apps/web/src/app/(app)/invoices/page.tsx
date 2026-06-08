'use client';

import { useState } from 'react';
import { Download, Plus, Search, Filter, ExternalLink, MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react';

/* ── Mock data ─────────────────────────────────────────────────────── */
const INVOICES = [
  { id: 'INV-2025-0091', vendor: 'Acuity Pharma Supplies', category: 'Raw Materials', amount: 184500, tax: 33210, total: 217710, issued: '2025-05-28', due: '2025-06-27', status: 'PENDING', avatar: 'AP' },
  { id: 'INV-2025-0090', vendor: 'LabCore Solutions', category: 'Equipment', amount: 96000, tax: 17280, total: 113280, issued: '2025-05-20', due: '2025-06-19', status: 'APPROVED', avatar: 'LC' },
  { id: 'INV-2025-0089', vendor: 'MediPackage Co.', category: 'Packaging', amount: 42300, tax: 7614, total: 49914, issued: '2025-05-15', due: '2025-06-14', status: 'PAID', avatar: 'MP' },
  { id: 'INV-2025-0088', vendor: 'ChemFirst India', category: 'Chemicals', amount: 310000, tax: 55800, total: 365800, issued: '2025-04-30', due: '2025-05-30', status: 'OVERDUE', avatar: 'CF' },
  { id: 'INV-2025-0087', vendor: 'SafeLogix Transport', category: 'Logistics', amount: 28750, tax: 5175, total: 33925, issued: '2025-05-10', due: '2025-06-09', status: 'PAID', avatar: 'SL' },
  { id: 'INV-2025-0086', vendor: 'NovaCal Instruments', category: 'Equipment', amount: 125000, tax: 22500, total: 147500, issued: '2025-05-22', due: '2025-06-21', status: 'PENDING', avatar: 'NI' },
  { id: 'INV-2025-0085', vendor: 'BioShield Packaging', category: 'Packaging', amount: 61200, tax: 11016, total: 72216, issued: '2025-04-18', due: '2025-05-18', status: 'OVERDUE', avatar: 'BP' },
  { id: 'INV-2025-0084', vendor: 'Vertex Compliance', category: 'Services', amount: 55000, tax: 9900, total: 64900, issued: '2025-05-25', due: '2025-06-24', status: 'APPROVED', avatar: 'VC' },
  { id: 'INV-2025-0083', vendor: 'PharmaLink Wholesale', category: 'Raw Materials', amount: 220000, tax: 39600, total: 259600, issued: '2025-05-01', due: '2025-05-31', status: 'PAID', avatar: 'PL' },
  { id: 'INV-2025-0082', vendor: 'Axiom IT Systems', category: 'IT & Software', amount: 38400, tax: 6912, total: 45312, issued: '2025-05-18', due: '2025-06-17', status: 'PENDING', avatar: 'AI' },
];

const FILTERS = ['All', 'Pending', 'Approved', 'Overdue', 'Paid'] as const;
type InvFilter = typeof FILTERS[number];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type StatusEntry = { label: string; badge: string; dot: string };
const STATUS_CONFIG: Record<string, StatusEntry> = {
  PENDING:  { label: 'Pending',  badge: 'bg-tertiary/10 text-tertiary border-tertiary/20',    dot: 'bg-tertiary' },
  APPROVED: { label: 'Approved', badge: 'bg-secondary/10 text-secondary border-secondary/20', dot: 'bg-secondary' },
  PAID:     { label: 'Paid',     badge: 'bg-success/10 text-success border-success/20',        dot: 'bg-success' },
  OVERDUE:  { label: 'Overdue',  badge: 'bg-error/10 text-error border-error/20',             dot: 'bg-error' },
};

const VENDOR_COLORS = ['#aa3000', '#01677d', '#7c4dff', '#00796b', '#e65100', '#1565c0', '#6a1b9a', '#ad1457'];
const vendorColor = (avatar: string) =>
  VENDOR_COLORS[(avatar.charCodeAt(0) + avatar.charCodeAt(1)) % VENDOR_COLORS.length];

/* ── Stat card ─────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon, accent, trend,
}: {
  label: string; value: string; sub: string; icon: string; accent: string;
  trend?: { up: boolean; text: string };
}) {
  return (
    <div
      className="glass-card rounded-2xl p-5 flex flex-col gap-3 card-hover"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ color: accent, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              trend.up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}
          >
            {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend.text}
          </div>
        )}
      </div>
      <div>
        <div className="text-[22px] font-bold text-on-surface leading-none tracking-tight">
          {value}
        </div>
        <div className="text-[12px] text-on-surface-variant mt-1 font-medium">{label}</div>
        <div className="text-[11px] text-on-surface-variant/60 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function InvoicesPage() {
  const [filter, setFilter] = useState<InvFilter>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = INVOICES.filter(inv => {
    const matchStatus = filter === 'All' || inv.status === filter.toUpperCase();
    const q = search.toLowerCase();
    const matchSearch = inv.vendor.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPaid    = INVOICES.filter(i => i.status === 'PAID').reduce((a, b) => a + b.total, 0);
  const totalPending = INVOICES.filter(i => i.status === 'PENDING').reduce((a, b) => a + b.total, 0);
  const totalOverdue = INVOICES.filter(i => i.status === 'OVERDUE').reduce((a, b) => a + b.total, 0);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-[22px] font-bold text-on-surface tracking-tight"
                style={{ letterSpacing: '-0.02em' }}
              >
                Invoices
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                {INVOICES.length} total &middot; {INVOICES.filter(i => i.status === 'OVERDUE').length} overdue
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors">
                <Download size={14} />
                Export
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-on-primary"
                style={{
                  background: 'linear-gradient(135deg, #aa3000 0%, #c53800 100%)',
                  boxShadow: '0 2px 12px rgba(170,48,0,0.30)',
                }}
              >
                <Plus size={14} />
                New Invoice
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Paid" value={fmt(totalPaid)} sub="This quarter"
              icon="task_alt" accent="#059669" trend={{ up: true, text: '+12%' }}
            />
            <StatCard
              label="Pending Approval" value={fmt(totalPending)}
              sub={`${INVOICES.filter(i => i.status === 'PENDING').length} invoices`}
              icon="pending_actions" accent="#01677d"
            />
            <StatCard
              label="Overdue" value={fmt(totalOverdue)}
              sub={`${INVOICES.filter(i => i.status === 'OVERDUE').length} invoices`}
              icon="error_outline" accent="#ba1a1a" trend={{ up: false, text: '+2 this week' }}
            />
            <StatCard
              label="Total Invoices" value={String(INVOICES.length)} sub="All time"
              icon="description" accent="#aa3000" trend={{ up: true, text: '+4 new' }}
            />
          </div>

          {/* Table card */}
          <div className="glass-card rounded-2xl overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 flex-wrap">
              {/* Filter tabs */}
              <div
                className="flex items-center gap-0.5 p-1 rounded-xl"
                style={{ background: 'rgba(19,27,46,0.04)' }}
              >
                {FILTERS.map(f => {
                  const count = f === 'All' ? INVOICES.length : INVOICES.filter(i => i.status === f.toUpperCase()).length;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                        filter === f
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {f}
                      {f !== 'All' && count > 0 && (
                        <span
                          className={`ml-1.5 text-[9.5px] px-1.5 py-px rounded-full font-bold ${
                            filter === f ? 'bg-white/25 text-white' : 'bg-on-surface-variant/10 text-on-surface-variant'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(19,27,46,0.03)',
                  border: '1px solid rgba(226,191,181,0.4)',
                  minWidth: 210,
                }}
              >
                <Search size={12} className="text-on-surface-variant/50 flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search invoices…"
                  className="bg-transparent border-none outline-none text-[12.5px] text-on-surface placeholder:text-on-surface-variant/40 flex-1 font-medium"
                />
              </div>

              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors">
                <Filter size={12} />
                Filter
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto" style={{ borderTop: '1px solid rgba(226,191,181,0.25)' }}>
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr style={{ background: 'rgba(19,27,46,0.025)' }}>
                    {['', 'Invoice #', 'Vendor', 'Category', 'Total Amount', 'Due Date', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-2.5 text-left text-[10.5px] font-bold text-on-surface-variant/55 tracking-[0.06em] uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, idx) => {
                    const s: StatusEntry = STATUS_CONFIG[inv.status] ?? { label: inv.status, badge: 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20', dot: 'bg-on-surface-variant' };
                    const color = vendorColor(inv.avatar);
                    const isSelected = selected.has(inv.id);
                    const isOverdue = inv.status === 'OVERDUE';
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => toggleSelect(inv.id)}
                        className="group cursor-pointer"
                        style={{
                          background: isSelected ? 'rgba(170,48,0,0.035)' : undefined,
                          borderTop: idx === 0 ? undefined : '1px solid rgba(226,191,181,0.18)',
                          transition: 'background 100ms ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected)
                            (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(19,27,46,0.022)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected)
                            (e.currentTarget as HTMLTableRowElement).style.background = '';
                        }}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 w-10">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isSelected ? 'border-primary bg-primary' : 'border-card-border'
                            }`}
                          >
                            {isSelected && (
                              <span
                                className="material-symbols-outlined text-on-primary"
                                style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}
                              >
                                check
                              </span>
                            )}
                          </div>
                        </td>
                        {/* ID */}
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] font-mono font-semibold text-on-surface">{inv.id}</span>
                        </td>
                        {/* Vendor */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: color }}
                            >
                              {inv.avatar}
                            </div>
                            <span className="text-[13px] font-medium text-on-surface truncate max-w-[160px]">
                              {inv.vendor}
                            </span>
                          </div>
                        </td>
                        {/* Category */}
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-on-surface-variant">{inv.category}</span>
                        </td>
                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <div className="text-[13px] font-bold text-on-surface">{fmt(inv.total)}</div>
                          <div className="text-[10.5px] text-on-surface-variant/55 mt-0.5">
                            incl. {fmt(inv.tax)} GST
                          </div>
                        </td>
                        {/* Due date */}
                        <td className="px-4 py-3.5">
                          <div
                            className={`flex items-center gap-1 text-[12px] font-medium ${
                              isOverdue ? 'text-error' : 'text-on-surface-variant'
                            }`}
                          >
                            {isOverdue && (
                              <span
                                className="material-symbols-outlined text-[13px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                warning
                              </span>
                            )}
                            {new Date(inv.due).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        {/* Status badge */}
                        <td className="px-4 py-3.5">
                          <span className={`chip border ${s.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        {/* Row actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors">
                              <ExternalLink size={12} />
                            </button>
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
                              <MoreHorizontal size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span
                    className="material-symbols-outlined text-[40px] text-on-surface-variant/25"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
                  >
                    search_off
                  </span>
                  <p className="text-[13px] text-on-surface-variant/50 font-medium">
                    No invoices match your filter
                  </p>
                </div>
              )}
            </div>

            {/* Pagination footer */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid rgba(226,191,181,0.25)' }}
            >
              <span className="text-[11.5px] text-on-surface-variant/55 font-medium">
                Showing {filtered.length} of {INVOICES.length} invoices
              </span>
              <div className="flex items-center gap-0.5">
                {(['chevron_left', 'chevron_right'] as const).map(icon => (
                  <button
                    key={icon}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
