'use client';

import { useEffect, useMemo, useState } from 'react';
import { salaryService } from '@/lib/api/salary';
import { useAuthStore } from '@/store/auth.store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WAGE_SHEET_MONTH = 6;
const WAGE_SHEET_YEAR = 2026;

type PayrollRunSummary = {
  id: string;
  month: number;
  year: number;
  status: string;
  createdAt?: string;
  totals?: {
    employees: number;
    grossSalary: number;
    deductions: number;
    netPayable: number;
  };
};

type PayrollRunRow = {
  id: string;
  employee?: {
    firstName?: string;
    lastName?: string;
    employeeCode?: string;
    designation?: string;
    department?: { name?: string };
  };
  paidDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays: number;
  missingPunchDays: number;
  grossSalary: number;
  deductions: number;
  netPayable: number;
};

type PayrollRunDetail = PayrollRunSummary & {
  rows?: PayrollRunRow[];
};

type ReconcileResult = {
  fileName?: string;
  extractedRows?: number;
  summary?: {
    matched?: number;
    mismatched?: number;
    unmatchedExternal?: number;
    missingExternal?: number;
  };
};

const statusClass: Record<string, string> = {
  DRAFT: 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20',
  REVIEWED: 'bg-success/10 text-success border-success/20',
  APPROVED: 'bg-success/10 text-success border-success/20',
};

function money(value?: number) {
  return `INR ${Number(value ?? 0).toLocaleString('en-IN')}`;
}

export default function WageSheetPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await salaryService.payrollRuns({ month: WAGE_SHEET_MONTH, year: WAGE_SHEET_YEAR });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setRuns(list);
      if (list.length > 0) {
        const detail = await salaryService.payrollRun(list[0].id).catch(() => list[0]);
        setSelectedRun(detail);
      } else {
        setSelectedRun(null);
      }
      setReconcileResult(null);
    } catch (err: any) {
      setRuns([]);
      setSelectedRun(null);
      setError(err?.response?.data?.message ?? err?.message ?? 'Unable to load wage sheet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void loadRuns();
  }, [isAdmin]);

  const totals = selectedRun?.totals;
  const rows = useMemo<PayrollRunRow[]>(() => {
    return (selectedRun?.rows ?? []).map((row) => ({
      id: row.id,
      employee: row.employee,
      paidDays: row.paidDays,
      presentDays: row.presentDays,
      leaveDays: row.leaveDays,
      lopDays: row.lopDays,
      missingPunchDays: row.missingPunchDays,
      grossSalary: row.grossSalary,
      deductions: row.deductions,
      netPayable: row.netPayable,
    }));
  }, [selectedRun]);

  const generateRun = async () => {
    setActionLoading(true);
    try {
      const run = await salaryService.generatePayrollRun({ month: WAGE_SHEET_MONTH, year: WAGE_SHEET_YEAR });
      setSelectedRun(run);
      await loadRuns();
    } finally {
      setActionLoading(false);
    }
  };

  const reviewRun = async () => {
    if (!selectedRun) return;
    setActionLoading(true);
    try {
      const run = await salaryService.reviewPayrollRun(selectedRun.id);
      setSelectedRun(run);
      await loadRuns();
    } finally {
      setActionLoading(false);
    }
  };

  const openRun = async (id: string) => {
    setActionLoading(true);
    try {
      const detail = await salaryService.payrollRun(id);
      setSelectedRun(detail);
      setReconcileResult(null);
    } finally {
      setActionLoading(false);
    }
  };

  const uploadWageSheet = async (file?: File) => {
    if (!selectedRun || !file) return;
    setActionLoading(true);
    try {
      const result = await salaryService.reconcilePayrollRun(selectedRun.id, { documentType: 'WAGE_SHEET', file });
      setReconcileResult(result);
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant">
        Loading your access details...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant">
        Wage sheet access is available only for admins and super admins.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg animate-fade-in">
      <div className="border-b border-card-border pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs font-bold">
          <span className="material-symbols-outlined text-[18px]">table_view</span>
          WAGE SHEET
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Wage Sheet</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Wage Sheet</h2>
            <p className="text-on-surface-variant mt-xs text-sm">
              Review attendance-linked wage rows, gross pay, deductions, and net payable before statutory reconciliation.
            </p>
          </div>
          <button
            onClick={generateRun}
            disabled={actionLoading}
            className="flex items-center gap-xs text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full shadow-lg shadow-primary/15 transition-all disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">play_circle</span>
            {actionLoading ? 'Working...' : 'Generate Wage Sheet'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-xs bg-card border border-card-border p-2.5 rounded-3xl shadow-sm shrink-0">
        <div className="px-4 py-2 rounded-full text-[10px] font-bold border whitespace-nowrap bg-primary border-primary text-on-primary shadow-sm">
          Jun 2026
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-lg">
        <div className="bg-card border border-card-border rounded-3xl p-4 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-sm text-on-surface">Payroll Runs</h3>
            <span className="text-[10px] font-bold text-on-surface-variant">{runs.length}</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-surface-container-highest animate-pulse" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl text-outline">table_view</span>
              <p className="text-xs mt-2">No wage sheet generated for Jun 2026.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map(run => (
                <button
                  key={run.id}
                  onClick={() => openRun(run.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedRun?.id === run.id ? 'border-primary bg-primary/5' : 'border-card-border hover:bg-surface-container-low'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-on-surface">{MONTHS[run.month - 1]} {run.year}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusClass[run.status] ?? statusClass.DRAFT}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-1 font-mono">
                    Net {money(run.totals?.netPayable)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-lg min-w-0">
          {error && (
            <div className="bg-error/5 border border-error/20 text-error rounded-3xl p-4 text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
            {[
              { label: 'Employees', value: totals?.employees ?? 0, icon: 'groups' },
              { label: 'Gross Salary', value: money(totals?.grossSalary), icon: 'payments' },
              { label: 'Deductions', value: money(totals?.deductions), icon: 'remove_circle' },
              { label: 'Net Payable', value: money(totals?.netPayable), icon: 'account_balance_wallet' },
            ].map(card => (
              <div key={card.label} className="bg-card border border-card-border rounded-3xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[17px]">{card.icon}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider">{card.label}</span>
                </div>
                <div className="font-extrabold text-sm text-on-surface mt-2 font-mono">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-card-border rounded-3xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-extrabold text-sm text-on-surface">Wage Sheet Reconciliation</h3>
              <p className="text-xs text-on-surface-variant mt-1">Upload the wage sheet PDF to compare external rows against EMS payroll rows.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedRun && selectedRun.status !== 'REVIEWED' && (
                <button
                  onClick={reviewRun}
                  disabled={actionLoading}
                  className="text-xs font-bold bg-success/10 hover:bg-success/15 text-success border border-success/20 px-4 py-2 rounded-full transition-all disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
              )}
              <label className="cursor-pointer text-xs font-bold bg-surface-container-low hover:bg-surface-container border border-card-border text-on-surface px-4 py-2 rounded-full transition-all">
                Upload PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={!selectedRun || actionLoading}
                  onChange={(event) => uploadWageSheet(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {reconcileResult && (
            <div className="bg-success/5 border border-success/20 rounded-3xl p-4">
              <div className="text-[10px] font-bold text-success uppercase tracking-widest">Reconciliation Complete</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-sm mt-3">
                {[
                  { label: 'Matched', value: reconcileResult.summary?.matched ?? 0 },
                  { label: 'Mismatched', value: reconcileResult.summary?.mismatched ?? 0 },
                  { label: 'Unmatched', value: reconcileResult.summary?.unmatchedExternal ?? 0 },
                  { label: 'Missing', value: reconcileResult.summary?.missingExternal ?? 0 },
                ].map(item => (
                  <div key={item.label} className="bg-card border border-card-border rounded-2xl p-3">
                    <div className="text-[9px] font-bold uppercase text-on-surface-variant">{item.label}</div>
                    <div className="font-extrabold text-lg text-on-surface">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-card-border flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-on-surface">
                  Employee Wage Rows {selectedRun ? `- ${MONTHS[selectedRun.month - 1]} ${selectedRun.year}` : ''}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">Attendance days, LOP, deductions, and net payable.</p>
              </div>
              {selectedRun && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${statusClass[selectedRun.status] ?? statusClass.DRAFT}`}>
                  {selectedRun.status}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-2xl bg-surface-container-highest animate-pulse" />)}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-lg text-center text-on-surface-variant text-sm">
                Generate a wage sheet to view employee rows.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase tracking-wider text-[9px]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Employee</th>
                      <th className="px-4 py-3 font-bold">Paid</th>
                      <th className="px-4 py-3 font-bold">Present</th>
                      <th className="px-4 py-3 font-bold">Leave</th>
                      <th className="px-4 py-3 font-bold">LOP</th>
                      <th className="px-4 py-3 font-bold">Gross</th>
                      <th className="px-4 py-3 font-bold">Deductions</th>
                      <th className="px-4 py-3 font-bold">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {rows.map(row => {
                      const employeeName = `${row.employee?.firstName ?? ''} ${row.employee?.lastName ?? ''}`.trim() || 'Employee';
                      return (
                        <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-3 min-w-[220px]">
                            <div className="font-bold text-on-surface">{employeeName}</div>
                            <div className="text-[10px] text-on-surface-variant mt-0.5">
                              {row.employee?.employeeCode ?? 'No code'} - {row.employee?.department?.name ?? row.employee?.designation ?? 'Operations'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-on-surface">{row.paidDays}</td>
                          <td className="px-4 py-3 font-mono text-on-surface">{row.presentDays}</td>
                          <td className="px-4 py-3 font-mono text-on-surface">{row.leaveDays}</td>
                          <td className="px-4 py-3 font-mono text-error">{row.lopDays}</td>
                          <td className="px-4 py-3 font-mono text-on-surface">{money(row.grossSalary)}</td>
                          <td className="px-4 py-3 font-mono text-error">{money(row.deductions)}</td>
                          <td className="px-4 py-3 font-mono text-success font-bold">{money(row.netPayable)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
