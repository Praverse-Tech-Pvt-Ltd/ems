'use client';

import { useState, useEffect } from 'react';
import { salaryService } from '@/lib/api/salary';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import type { SalarySlip } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SLIP_STATUS_COLOR: Record<string, string> = {
  DRAFT:            'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20',
  PENDING_APPROVAL: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  APPROVED:         'bg-success/10 text-success border-success/20',
  TRANSFERRED:      'bg-success/10 text-success border-success/20',
  REJECTED:         'bg-error/10 text-error border-error/20',
};

type SalaryStructure = {
  id: string;
  basic: number | string;
  hra: number | string;
  allowances: number | string;
  pfDeduction: number | string;
  professionalTax: number | string;
  tds: number | string;
  effectiveFrom: string;
  notes?: string | null;
  employee?: {
    firstName?: string;
    lastName?: string;
    employeeCode?: string;
    email?: string;
    designation?: string;
    salaryGrade?: string | null;
  };
  approver?: {
    firstName?: string;
    lastName?: string;
  } | null;
};

function formatMoney(value: number | string | undefined | null) {
  return `INR ${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function SalaryPayslipsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [mySlips, setMySlips] = useState<SalarySlip[]>([]);
  const [allSlips, setAllSlips] = useState<any[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const mine = await queryClient.fetchQuery({ queryKey: ['salary-my', user?.id], queryFn: () => salaryService.mySlips() }).catch(() => []);
      setMySlips(Array.isArray(mine) ? mine : mine?.data ?? []);
      if (isAdmin) {
        const all = await queryClient.fetchQuery({ queryKey: ['salary-all', selectedMonth, selectedYear], queryFn: () => salaryService.allSlips({ month: selectedMonth, year: selectedYear }) }).catch(() => []);
        setAllSlips(Array.isArray(all) ? all : all?.data ?? []);
        const structureRows = await queryClient.fetchQuery({ queryKey: ['salary-structures'], queryFn: () => salaryService.structures() }).catch(() => []);
        setStructures(Array.isArray(structureRows) ? structureRows : structureRows?.data ?? []);
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

  const getBreakdown = (slip?: SalarySlip) => {
    if (!slip) return { basic: 0, hra: 0, special: 0, pf: 0, pt: 0 };
    const gross = Number(slip.grossSalary);
    const basic = Math.round(gross * 0.5);
    const hra = Math.round(gross * 0.3);
    const special = gross - basic - hra;
    const totalDeductions = Number(slip.deductions);
    const pt = gross > 15000 ? 200 : 0;
    const pf = Math.max(0, totalDeductions - pt);
    return { basic, hra, special, pf, pt };
  };

  const { basic, hra, special, pf, pt } = getBreakdown(currentSlip);

  return (
    <div className="flex flex-col gap-lg animate-fade-in">
      {/* Header */}
      <div className="border-b border-card-border pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs font-bold">
          <span className="material-symbols-outlined text-[18px]">payments</span>
          PAYROLL
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Salary & Payroll Hub</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Salary & Payslips</h2>
            <p className="text-on-surface-variant mt-xs text-sm">Review gross earnings, deductions structure, and download payslips.</p>
          </div>
          {isAdmin && (
            <button className="flex items-center gap-xs text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full shadow-lg shadow-primary/15 transition-all shrink-0">
              <span className="material-symbols-outlined text-[16px]">play_circle</span>Run Monthly Payroll
            </button>
          )}
        </div>
      </div>

      {/* Month selector timeline chips */}
      <div className="flex gap-2 overflow-x-auto pb-xs bg-card border border-card-border p-2.5 rounded-3xl shadow-sm shrink-0">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i + 1)}
            className={`min-h-11 px-4 py-2 rounded-full text-[10px] font-bold border whitespace-nowrap transition-all ${selectedMonth === i + 1 ? 'bg-primary border-primary text-on-primary shadow-sm' : 'border-card-border text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            {m} {selectedYear}
          </button>
        ))}
      </div>

      {/* Admin: salary structures */}
      {isAdmin && (
        <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-card-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest font-bold">
                DETAILED SALARY STRUCTURES
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Current salary components and statutory split from employee documents and EMS payroll records.
              </p>
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low border border-card-border px-3 py-1 rounded-full">
              {structures.length} records
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-2xl bg-surface-container-highest animate-pulse" />
              ))}
            </div>
          ) : structures.length === 0 ? (
            <div className="p-lg text-center text-on-surface-variant text-sm">
              No salary structures have been defined yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Employee</th>
                    <th className="px-4 py-3 font-bold">Effective</th>
                    <th className="px-4 py-3 font-bold">Basic</th>
                    <th className="px-4 py-3 font-bold">HRA</th>
                    <th className="px-4 py-3 font-bold">Allowances</th>
                    <th className="px-4 py-3 font-bold">Gross</th>
                    <th className="px-4 py-3 font-bold">Emp. PF</th>
                    <th className="px-4 py-3 font-bold">Employer EPF</th>
                    <th className="px-4 py-3 font-bold">Employer EPS</th>
                    <th className="px-4 py-3 font-bold">Emp. ESIC</th>
                    <th className="px-4 py-3 font-bold">Employer ESIC</th>
                    <th className="px-4 py-3 font-bold">PT</th>
                    <th className="px-4 py-3 font-bold">TDS</th>
                    <th className="px-4 py-3 font-bold">Net Model</th>
                    <th className="px-4 py-3 font-bold">Approved By</th>
                    <th className="px-4 py-3 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {structures.map((structure) => {
                    const basic = Number(structure.basic ?? 0);
                    const hra = Number(structure.hra ?? 0);
                    const allowances = Number(structure.allowances ?? 0);
                    const pf = Number(structure.pfDeduction ?? 0);
                    const pt = Number(structure.professionalTax ?? 0);
                    const tds = Number(structure.tds ?? 0);
                    const gross = basic + hra + allowances;
                    const isIntern = structure.employee?.salaryGrade === 'INTERN' || /intern stipend/i.test(structure.notes ?? '');
                    const pfWageBase = pf > 0 ? pf / 0.12 : Math.min(basic, 15000);
                    const employerEps = pf > 0 ? Math.min(roundMoney(pfWageBase * 0.0833), 1250) : 0;
                    const employerEpf = pf > 0 ? roundMoney(pf - employerEps) : 0;
                    const employeeEsic = !isIntern && gross > 0 && gross <= 21000 ? roundMoney(gross * 0.0075) : 0;
                    const employerEsic = !isIntern && gross > 0 && gross <= 21000 ? roundMoney(gross * 0.0325) : 0;
                    const net = Math.max(roundMoney(gross - pf - employeeEsic - pt - tds), 0);
                    const employeeName = `${structure.employee?.firstName ?? ''} ${structure.employee?.lastName ?? ''}`.trim() || 'Employee';
                    const approverName = structure.approver
                      ? `${structure.approver.firstName ?? ''} ${structure.approver.lastName ?? ''}`.trim()
                      : '-';

                    return (
                      <tr key={structure.id} className="hover:bg-surface-container-low transition-colors align-top">
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="font-bold text-on-surface">{employeeName}</div>
                          <div className="text-[10px] text-on-surface-variant mt-0.5">
                            {structure.employee?.employeeCode ?? 'No code'} - {structure.employee?.designation ?? 'No designation'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatDate(structure.effectiveFrom)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(basic)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(hra)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(allowances)}</td>
                        <td className="px-4 py-3 font-mono text-secondary font-bold whitespace-nowrap">{formatMoney(gross)}</td>
                        <td className="px-4 py-3 font-mono text-error whitespace-nowrap">{formatMoney(pf)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(employerEpf)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(employerEps)}</td>
                        <td className="px-4 py-3 font-mono text-error whitespace-nowrap">{formatMoney(employeeEsic)}</td>
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">{formatMoney(employerEsic)}</td>
                        <td className="px-4 py-3 font-mono text-error whitespace-nowrap">{formatMoney(pt)}</td>
                        <td className="px-4 py-3 font-mono text-error whitespace-nowrap">{formatMoney(tds)}</td>
                        <td className="px-4 py-3 font-mono text-success font-bold whitespace-nowrap">{formatMoney(net)}</td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{approverName || '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant min-w-[260px]">{structure.notes ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Two Columns Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">

        {/* Left Column: Gross Salary Model card */}
        <div className="bg-card border border-card-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-on-surface mb-4">My Gross Salary Model</h3>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-5 bg-surface-container-highest animate-pulse rounded" />
                ))}
              </div>
            ) : !currentSlip ? (
              <div className="text-center py-6 text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl text-outline">credit_card_off</span>
                <p className="text-xs mt-2">No active salary model found for this month.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs font-semibold text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Basic Salary (50%):</span>
                  <span className="font-bold text-on-surface font-mono">₹{basic.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>HRA (30%):</span>
                  <span className="font-bold text-on-surface font-mono">₹{hra.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Special Allowance (20%):</span>
                  <span className="font-bold text-on-surface font-mono">₹{special.toLocaleString('en-IN')}</span>
                </div>

                <div className="h-px bg-card-border my-2"></div>
                <div className="text-[9px] uppercase font-extrabold text-on-surface-variant tracking-wider">Deductions</div>

                <div className="flex items-center justify-between text-error">
                  <span>Provident Fund (PF):</span>
                  <span className="font-bold font-mono">-₹{pf.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-error">
                  <span>Professional Tax (PT):</span>
                  <span className="font-bold font-mono">-₹{pt.toLocaleString('en-IN')}</span>
                </div>

                <div className="h-px bg-card-border my-2"></div>
                <div className="flex items-center justify-between text-on-surface font-extrabold text-xs">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-error">-₹{Number(currentSlip.deductions).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-on-surface font-extrabold text-sm border-t border-card-border pt-2">
                  <span>Gross Salary Model:</span>
                  <span className="font-mono text-secondary">₹{Number(currentSlip.grossSalary).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Selected Payslip Quick Summary and History logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-card-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <h3 className="font-extrabold text-sm text-on-surface mb-4">Payslip Overview — {MONTHS[selectedMonth - 1]} {selectedYear}</h3>

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-sm">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 bg-surface-container-highest animate-pulse rounded" />
                  ))}
                </div>
                <div className="h-10 bg-surface-container-highest animate-pulse rounded" />
              </div>
            ) : !currentSlip ? (
              <div className="text-center py-8 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl text-outline">receipt_long</span>
                <p className="text-xs mt-2">No payslip generated for {MONTHS[selectedMonth - 1]} {selectedYear} yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
                  {[
                    { label: 'Gross Salary', value: `₹${Number(currentSlip.grossSalary).toLocaleString('en-IN')}`, color: 'text-secondary' },
                    { label: 'Deductions', value: `₹${Number(currentSlip.deductions).toLocaleString('en-IN')}`, color: 'text-error' },
                    { label: 'Net Payable', value: `₹${Number(currentSlip.netPayable).toLocaleString('en-IN')}`, color: 'text-success' },
                    { label: 'Attended Days', value: `${currentSlip.daysPresent} Days`, color: 'text-on-surface' },
                  ].map(s => (
                    <div key={s.label} className="bg-surface-container-low rounded-2xl p-4 text-center border border-card-border">
                      <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">{s.label}</p>
                      <p className={`font-extrabold text-sm mt-1.5 font-mono ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-success/5 border border-l-4 border-l-success border-success/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-success uppercase tracking-widest">NET TRANSFER AMOUNT</span>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Factor: {currentSlip.lopDays} LOP (Loss of Pay) day(s)</span>
                  </div>
                  <span className="font-extrabold text-success text-2xl font-mono">₹{Number(currentSlip.netPayable).toLocaleString('en-IN')}</span>
                </div>

                <a
                  href={salaryService.slipPdfUrl(currentSlip.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 border border-card-border text-on-surface-variant font-bold text-xs py-3 rounded-2xl hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download PDF Payslip
                </a>
              </div>
            )}
          </div>

          {/* Historical Payslips List */}
          <div className="space-y-3">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">ALL HISTORICAL PAYSLIPS</p>
            <div className="flex flex-col gap-sm">
              {loading ? (
                [1, 2].map(i => (
                  <div key={i} className="h-16 rounded-2xl bg-surface-container-highest animate-pulse" />
                ))
              ) : mySlips.length === 0 ? (
                <div className="bg-card border border-card-border rounded-3xl p-6 text-center text-on-surface-variant text-xs">
                  No payroll logs recorded.
                </div>
              ) : (
                mySlips.map(slip => (
                  <div
                    key={slip.id}
                    onClick={() => setSelectedMonth(slip.month)}
                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-all ${slip.month === selectedMonth && slip.year === selectedYear ? 'border-primary bg-primary/5' : 'bg-card border-card-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-card-border">
                        <span className="material-symbols-outlined text-secondary text-lg">receipt</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-on-surface">Payslip — {MONTHS[slip.month - 1]} {slip.year}</span>
                        <span className="text-[10px] text-on-surface-variant mt-0.5 font-mono">Net Payout: ₹{Number(slip.netPayable).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <span className="px-2.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 text-[9px] font-bold uppercase tracking-wider">PAID</span>
                      <a
                        href={salaryService.slipPdfUrl(slip.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-surface-container-low border border-card-border text-on-surface-variant hover:text-on-surface rounded-lg"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Admin: all employee payslips */}
      {isAdmin && (
        <div className="mt-4">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm font-bold">
            ALL COLLEAGUE PAYROLL OVERVIEW — {MONTHS[selectedMonth - 1]} {selectedYear}
          </p>
          {loading ? (
            <div className="flex flex-col gap-sm">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-3xl bg-surface-container-highest animate-pulse" />
              ))}
            </div>
          ) : allSlips.length === 0 ? (
            <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant text-sm">
              No employee payslips generated for this period.
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
              <div className="divide-y divide-card-border">
                {allSlips.map(slip => {
                  const employeeName = `${slip.employee?.firstName} ${slip.employee?.lastName}`;
                  const initials = `${slip.employee?.firstName?.[0] || 'E'}${slip.employee?.lastName?.[0] || 'M'}`;
                  const deptInfo = slip.employee?.department?.name ?? slip.employee?.designation ?? 'Operations';

                  return (
                    <div key={slip.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-surface-container-low transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold text-xs shrink-0 border border-card-border">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-on-surface">{employeeName}</span>
                          <span className="text-xs text-on-surface-variant mt-0.5">{deptInfo}</span>
                        </div>
                      </div>

                      <div className="flex items-center flex-wrap gap-3 sm:gap-6">
                        <div className="hidden sm:block text-right">
                          <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider block">Gross</span>
                          <span className="font-bold text-xs text-on-surface font-mono">₹{Number(slip.grossSalary).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider block">Net Payable</span>
                          <span className="font-extrabold text-sm text-secondary font-mono">₹{Number(slip.netPayable).toLocaleString('en-IN')}</span>
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${SLIP_STATUS_COLOR[slip.status] ?? 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20'}`}>
                          {slip.status}
                        </span>

                        {(slip.status === 'PENDING_APPROVAL' || slip.status === 'DRAFT') && (
                          <button
                            onClick={() => handleApprove(slip.id)}
                            disabled={actionLoading === slip.id}
                            className="bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs px-4 py-2 rounded-full shadow-lg shadow-primary/10 transition-all disabled:opacity-50 shrink-0"
                          >
                            {actionLoading === slip.id ? '...' : 'Approve'}
                          </button>
                        )}

                        <a
                          href={salaryService.slipPdfUrl(slip.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-surface-container-low border border-card-border text-on-surface-variant hover:text-on-surface rounded-xl"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
