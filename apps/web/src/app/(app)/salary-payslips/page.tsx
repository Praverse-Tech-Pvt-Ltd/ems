'use client';

import { useState, useEffect } from 'react';
import { salaryService } from '@/lib/api/salary';
import { useAuthStore } from '@/store/auth.store';
import type { SalarySlip } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SLIP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
  PENDING_APPROVAL: 'bg-primary/10 text-primary border-primary/20',
  APPROVED: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  TRANSFERRED: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  REJECTED: 'bg-error/10 text-error border-error/20',
};

export default function SalaryPayslipsPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [mySlips, setMySlips] = useState<SalarySlip[]>([]);
  const [allSlips, setAllSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const mine = await salaryService.mySlips().catch(() => []);
      setMySlips(Array.isArray(mine) ? mine : mine?.data ?? []);
      if (isAdmin) {
        const all = await salaryService.allSlips({ month: selectedMonth, year: selectedYear }).catch(() => []);
        setAllSlips(Array.isArray(all) ? all : all?.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedMonth]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await salaryService.approve(id);
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const currentSlip = mySlips.find(s => s.month === selectedMonth && s.year === selectedYear);

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">payments</span>
          PAYROLL
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Salary & Payslips</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Salary & Payslips</h2>
            <p className="text-on-surface-variant mt-xs">Pay components, monthly slips, and transfer tracking.</p>
          </div>
          {isAdmin && (
            <button className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 shrink-0">
              <span className="material-symbols-outlined text-[16px]">play_circle</span>Run Payroll
            </button>
          )}
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-xs overflow-x-auto pb-xs">
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setSelectedMonth(i + 1)}
            className={`px-4 py-2 rounded-full text-label-caps font-label-caps text-[11px] border whitespace-nowrap transition-all ${selectedMonth === i + 1 ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
            {m} {selectedYear}
          </button>
        ))}
      </div>

      {/* My payslip */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-lg">
        <div className="glass-card rounded-2xl p-lg border border-outline-variant/30 flex flex-col gap-md">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">MY PAYSLIP — {MONTHS[selectedMonth - 1]} {selectedYear}</p>

          {loading ? (
            <div className="flex flex-col gap-sm">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded-lg bg-surface-container-high animate-pulse" />)}
            </div>
          ) : !currentSlip ? (
            <div className="text-center py-lg text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">receipt_long</span>
              <p className="mt-sm">No payslip generated for {MONTHS[selectedMonth - 1]} {selectedYear} yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
                {[
                  { label: 'Gross Pay', value: `₹${Number(currentSlip.grossSalary).toLocaleString('en-IN')}`, color: 'text-tertiary' },
                  { label: 'Deductions', value: `₹${Number(currentSlip.deductions).toLocaleString('en-IN')}`, color: 'text-error' },
                  { label: 'Net Pay', value: `₹${Number(currentSlip.netPayable).toLocaleString('en-IN')}`, color: 'text-primary' },
                  { label: 'Days Present', value: String(currentSlip.daysPresent), color: 'text-on-surface' },
                ].map(s => (
                  <div key={s.label} className="bg-surface-container-low rounded-xl p-sm text-center">
                    <p className="text-[10px] text-on-surface-variant font-label-caps">{s.label}</p>
                    <p className={`font-black text-lg mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-md flex items-center justify-between">
                <div>
                  <p className="font-label-caps text-label-caps text-primary tracking-widest">NET PAYABLE</p>
                  <p className="text-[10px] text-on-surface-variant">After all deductions · LOP: {currentSlip.lopDays} day(s)</p>
                </div>
                <p className="font-black text-on-surface text-3xl">₹{Number(currentSlip.netPayable).toLocaleString('en-IN')}</p>
              </div>

              <a href={salaryService.slipPdfUrl(currentSlip.id)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-sm border border-outline-variant/50 text-on-surface-variant font-label-caps text-label-caps py-2 rounded-xl hover:bg-surface-container-low hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download PDF
              </a>
            </>
          )}
        </div>

        {/* All slips list (my) */}
        <div className="flex flex-col gap-sm">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">ALL MY SLIPS</p>
          <div className="flex flex-col gap-xs">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-surface-container-high animate-pulse" />)
            ) : mySlips.length === 0 ? (
              <div className="glass-card rounded-xl p-md text-center text-on-surface-variant border border-outline-variant/30 text-body-sm">
                No payslips yet.
              </div>
            ) : (
              mySlips.map(slip => (
                <div key={slip.id}
                  onClick={() => setSelectedMonth(slip.month)}
                  className={`flex items-center gap-sm glass-card rounded-xl p-sm border cursor-pointer hover:border-primary/40 transition-all ${slip.month === selectedMonth && slip.year === selectedYear ? 'border-primary bg-primary/5' : 'border-outline-variant/30'}`}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                    {MONTHS[slip.month - 1]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface text-sm">{MONTHS[slip.month - 1]} {slip.year}</p>
                    <p className="text-[10px] text-on-surface-variant">₹{Number(slip.netPayable).toLocaleString('en-IN')} net</p>
                  </div>
                  <a href={salaryService.slipPdfUrl(slip.id)} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-on-surface-variant hover:text-primary transition-colors p-1">
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin: all employee payslips */}
      {isAdmin && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">ALL EMPLOYEE PAYSLIPS — {MONTHS[selectedMonth - 1]} {selectedYear}</p>
          {loading ? (
            <div className="flex flex-col gap-xs">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
            </div>
          ) : allSlips.length === 0 ? (
            <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
              No payslips generated for this month yet.
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
              <div className="divide-y divide-outline-variant/20">
                {allSlips.map(slip => (
                  <div key={slip.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                    <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                      {slip.employee?.firstName?.[0]}{slip.employee?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-sm">{slip.employee?.firstName} {slip.employee?.lastName}</p>
                      <p className="text-body-sm text-on-surface-variant">{slip.employee?.department?.name ?? slip.employee?.designation}</p>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-[10px] text-on-surface-variant">Gross</p>
                      <p className="font-semibold text-on-surface text-sm">₹{Number(slip.grossSalary).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface-variant">Net</p>
                      <p className="font-bold text-primary">₹{Number(slip.netPayable).toLocaleString('en-IN')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${SLIP_STATUS_COLOR[slip.status] ?? 'bg-surface-container-high text-on-surface-variant border-outline-variant/30'}`}>
                      {slip.status}
                    </span>
                    {(slip.status === 'PENDING_APPROVAL' || slip.status === 'DRAFT') && (
                      <button onClick={() => handleApprove(slip.id)} disabled={actionLoading === slip.id}
                        className="bg-tertiary/10 text-tertiary border border-tertiary/20 font-label-caps text-[10px] px-3 py-1.5 rounded-full hover:bg-tertiary/20 transition-colors disabled:opacity-50 shrink-0">
                        {actionLoading === slip.id ? '...' : 'Approve'}
                      </button>
                    )}
                    <a href={salaryService.slipPdfUrl(slip.id)} target="_blank" rel="noopener noreferrer"
                      className="text-on-surface-variant hover:text-primary transition-colors shrink-0 p-1">
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
