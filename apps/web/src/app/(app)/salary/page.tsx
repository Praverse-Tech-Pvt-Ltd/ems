'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import type { SalarySlip } from '@/types';
import { BarChart2, DollarSign, TrendingDown, FileText, Download } from 'lucide-react';

function monthLabel(slip: SalarySlip) {
  return new Date(slip.year, slip.month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function SalaryPage() {
  const { data: slips = [], isLoading } = useQuery<SalarySlip[]>({
    queryKey: ['salary-slips'],
    queryFn: () => apiClient.get('/salary/payslips').then((r) => r.data),
  });

  const latest = slips[0];
  const ytdGross      = slips.reduce((s, p) => s + (p.grossSalary ?? 0), 0);
  const ytdDeductions = slips.reduce((s, p) => s + (p.deductions ?? 0), 0);
  const ytdNet        = slips.reduce((s, p) => s + (p.netPayable ?? 0), 0);

  const dedPct = latest?.grossSalary && latest?.deductions
    ? Math.round((latest.deductions / latest.grossSalary) * 100)
    : 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
          Payroll &amp;<br />
          <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Salary</span>
        </h1>
        <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
          Year-to-date summary and payslip history
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign,   label: 'YTD Gross',      value: formatCurrency(ytdGross),      accent: 'yellow' as const },
          { icon: TrendingDown, label: 'YTD Deductions', value: formatCurrency(ytdDeductions), accent: undefined },
          { icon: BarChart2,    label: 'YTD Net Pay',    value: formatCurrency(ytdNet),         accent: 'blue' as const },
          { icon: FileText,     label: 'Payslips',       value: slips.length,                   accent: undefined },
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
              <p className={`font-display font-bold text-xl ${accent === 'blue' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Latest payslip breakdown */}
      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-brutal-ink text-white brutal-border brutal-shadow p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-display font-bold text-xs uppercase tracking-widest text-brutal-yellow mb-1">
                  Latest Payslip
                </p>
                <h2 className="font-display font-bold text-3xl uppercase">{monthLabel(latest)}</h2>
              </div>
              <button className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-2">
                <Download size={14} /> PDF
              </button>
            </div>

            {[
              { label: 'Gross Salary',  value: latest.grossSalary,  color: 'bg-brutal-yellow', pct: 100 },
              { label: 'Deductions',    value: latest.deductions,    color: 'bg-brutal-red',    pct: dedPct },
              { label: 'Net Payable',   value: latest.netPayable,    color: 'bg-brutal-blue',   pct: 100 - dedPct },
            ].map(({ label, value, color, pct }) => (
              <div key={label} className="mb-5">
                <div className="flex justify-between font-display font-bold text-sm uppercase mb-2">
                  <span className="text-white/70">{label}</span>
                  <span className="text-white">{formatCurrency(value)}</span>
                </div>
                <div className="w-full h-3 bg-white/10 border border-white/20">
                  <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="bg-brutal-white brutal-border brutal-shadow p-6">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4">Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Gross Salary',  value: latest.grossSalary },
                { label: 'Days Present',  value: `${latest.daysPresent} days` as unknown as number },
                { label: 'LOP Days',      value: `${latest.lopDays} days` as unknown as number },
                { label: '—',             value: null },
                { label: 'Deductions',    value: latest.deductions ? -latest.deductions : null },
              ].map(({ label, value }) => {
                if (label === '—') return <div key="sep" className="brutal-border-t my-2" />;
                return (
                  <div key={label} className="flex items-center justify-between">
                    <span className="font-body text-sm text-[#4a4a4a]">{label}</span>
                    <span className={`font-display font-bold text-sm ${
                      typeof value === 'number' && value < 0 ? 'text-brutal-red' : 'text-brutal-ink'
                    }`}>
                      {value == null
                        ? '—'
                        : typeof value === 'number'
                        ? formatCurrency(Math.abs(value))
                        : value}
                    </span>
                  </div>
                );
              })}
              <div className="brutal-border-t pt-3 flex items-center justify-between">
                <span className="font-display font-bold uppercase">Net Payable</span>
                <span className="font-display font-bold text-xl text-brutal-blue">{formatCurrency(latest.netPayable)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-brutal-white brutal-border brutal-shadow">
        <div className="px-6 py-4 brutal-border-b">
          <h3 className="font-display font-bold text-lg uppercase">Payslip History</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-brutal-surface animate-pulse" />)}
          </div>
        ) : slips.length === 0 ? (
          <p className="px-6 py-10 text-center font-display font-bold uppercase text-[#4a4a4a]">No payslips found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brutal-surface brutal-border-b">
                {['Period', 'Gross', 'Deductions', 'Net Pay', 'Days Present', 'Download'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold text-xs uppercase tracking-wide text-[#4a4a4a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slips.map((p, i) => (
                <tr key={p.id} className={`border-b-2 border-brutal-surface ${i % 2 !== 0 ? 'bg-brutal-surface-lo' : ''}`}>
                  <td className="px-5 py-3 font-display font-bold uppercase">{monthLabel(p)}</td>
                  <td className="px-5 py-3 font-body">{formatCurrency(p.grossSalary)}</td>
                  <td className="px-5 py-3 font-body text-brutal-red">{formatCurrency(p.deductions)}</td>
                  <td className="px-5 py-3 font-display font-bold text-brutal-blue">{formatCurrency(p.netPayable)}</td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{p.daysPresent}</td>
                  <td className="px-5 py-3">
                    <button className="flex items-center gap-1.5 brutal-btn-secondary px-3 py-1.5 text-xs">
                      <Download size={12} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
