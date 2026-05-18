'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Employee, SalarySlip } from '@/types';
import {
  BarChart2,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Mail,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

type PayrollStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED';

interface AdminSalarySlip extends SalarySlip {
  baseSalary?: number | string;
  incentives?: number | string;
  reimbursements?: number | string;
  status?: PayrollStatus;
  paymentRef?: string;
  approvedAt?: string;
  transferredAt?: string;
  emailSentAt?: string;
  signatureName?: string;
  signatureTitle?: string;
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'employeeCode' | 'email' | 'designation'>;
}

interface SalaryStructure {
  id: string;
  employeeId: string;
  basic: number | string;
  hra: number | string;
  allowances: number | string;
  pfDeduction: number | string;
  professionalTax: number | string;
  tds: number | string;
  effectiveFrom: string;
  signatureName?: string;
  signatureTitle?: string;
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'employeeCode' | 'email' | 'designation'>;
}

const currentDate = new Date();
const defaultMonth = currentDate.getMonth() + 1;
const defaultYear = currentDate.getFullYear();

function money(value: number | string | undefined | null) {
  return Number(value ?? 0);
}

function monthLabel(slip: Pick<SalarySlip, 'month' | 'year'>) {
  return new Date(slip.year, slip.month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function employeeLabel(employee?: Pick<Employee, 'firstName' | 'lastName' | 'employeeCode'>) {
  if (!employee) return 'Employee';
  return `${employee.firstName} ${employee.lastName} / ${employee.employeeCode}`;
}

export default function SalaryPage() {
  const user = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [basic, setBasic] = useState('50000');
  const [hra, setHra] = useState('20000');
  const [allowances, setAllowances] = useState('10000');
  const [pfDeduction, setPfDeduction] = useState('1800');
  const [professionalTax, setProfessionalTax] = useState('200');
  const [tds, setTds] = useState('0');
  const [incentives, setIncentives] = useState('0');
  const [extraDeductions, setExtraDeductions] = useState('0');
  const [month, setMonth] = useState(String(defaultMonth));
  const [year, setYear] = useState(String(defaultYear));
  const [signatureName, setSignatureName] = useState('Authorized Signatory');
  const [signatureTitle, setSignatureTitle] = useState('Payroll Approval');
  const [paymentRef, setPaymentRef] = useState('');

  const { data: mySlips = [], isLoading } = useQuery<AdminSalarySlip[]>({
    queryKey: ['salary-slips-my'],
    queryFn: () => apiClient.get('/salary/slips/my').then((r) => r.data),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-for-payroll'],
    queryFn: () => apiClient.get('/employees').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: allSlips = [] } = useQuery<AdminSalarySlip[]>({
    queryKey: ['salary-slips-admin'],
    queryFn: () => apiClient.get('/salary/slips').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: structures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: () => apiClient.get('/salary/structures').then((r) => r.data),
    enabled: isAdmin,
  });

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const selectedStructure = structures.find((s) => s.employeeId === selectedEmployeeId);

  const refreshPayroll = () => {
    queryClient.invalidateQueries({ queryKey: ['salary-slips-my'] });
    queryClient.invalidateQueries({ queryKey: ['salary-slips-admin'] });
    queryClient.invalidateQueries({ queryKey: ['salary-structures'] });
  };

  const saveStructure = useMutation({
    mutationFn: () => apiClient.post(`/salary/structures/${selectedEmployeeId}`, {
      basic: Number(basic),
      hra: Number(hra),
      allowances: Number(allowances),
      pfDeduction: Number(pfDeduction),
      professionalTax: Number(professionalTax),
      tds: Number(tds),
      effectiveFrom: `${year}-${String(month).padStart(2, '0')}-01`,
      signatureName,
      signatureTitle,
    }),
    onSuccess: refreshPayroll,
  });

  const generateSlip = useMutation({
    mutationFn: () => apiClient.post('/salary/slips/generate', {
      employeeId: selectedEmployeeId,
      month: Number(month),
      year: Number(year),
      incentives: Number(incentives),
      deductions: Number(extraDeductions),
      daysPresent: 30,
      lopDays: 0,
      signatureName,
      signatureTitle,
    }),
    onSuccess: refreshPayroll,
  });

  const approveSlip = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/salary/slips/${id}/approve`),
    onSuccess: refreshPayroll,
  });

  const transferSlip = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/salary/slips/${id}/transfer`, { paymentRef }),
    onSuccess: refreshPayroll,
  });

  const openPdf = async (id: string) => {
    const res = await apiClient.get(`/salary/slips/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  };

  const rejectSlip = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/salary/slips/${id}/reject`, { notes: 'Rejected from payroll approval queue' }),
    onSuccess: refreshPayroll,
  });

  const latest = mySlips[0];
  const ytdGross = mySlips.reduce((s, p) => s + money(p.grossSalary), 0);
  const ytdDeductions = mySlips.reduce((s, p) => s + money(p.deductions), 0);
  const ytdNet = mySlips.reduce((s, p) => s + money(p.netPayable), 0);
  const adminSlips = isAdmin ? allSlips : mySlips;

  const adminStats = useMemo(() => {
    const payroll = adminSlips.reduce((s, p) => s + money(p.netPayable), 0);
    return {
      structures: structures.length,
      drafts: adminSlips.filter((s) => (s.status ?? 'DRAFT') === 'DRAFT').length,
      approved: adminSlips.filter((s) => s.status === 'APPROVED').length,
      transferred: adminSlips.filter((s) => s.status === 'TRANSFERRED').length,
      payroll,
    };
  }, [adminSlips, structures]);

  const baseTotal = Number(basic || 0) + Number(hra || 0) + Number(allowances || 0);
  const totalDeductions = Number(pfDeduction || 0) + Number(professionalTax || 0) + Number(tds || 0) + Number(extraDeductions || 0);
  const previewNet = Math.max(baseTotal + Number(incentives || 0) - totalDeductions, 0);

  return (
    <div className="space-y-8 max-w-[1320px]">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— SALARY / 06 · {user?.role}</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-yellow px-2">PAYSLIPS</span> &amp; PAYROLL<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">SECURE · ENCRYPTED · GRADE M3</div>
        </div>
        {isAdmin && (
          <div className="brutal-border brutal-shadow bg-brutal-ink text-white px-5 py-4 min-w-[260px]">
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.25em] text-white/60">This Cycle Net Payroll</p>
            <p className="font-display font-bold text-3xl text-brutal-yellow">{formatCurrency(adminStats.payroll)}</p>
            <p className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-white/60">{adminStats.transferred} transferred / {adminStats.approved} approved</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="bg-brutal-white brutal-border brutal-shadow">
            <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-white flex items-center justify-between">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-2">
                <FileSignature size={16} /> Admin Payroll Generator
              </h2>
              <span className="bg-brutal-yellow text-brutal-ink px-2 py-1 font-display font-bold text-[10px] uppercase tracking-widest">Corporate Flow</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1 md:col-span-2">
                <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Employee</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedEmployeeId(value);
                    const existing = structures.find((s) => s.employeeId === value);
                    if (existing) {
                      setBasic(String(existing.basic));
                      setHra(String(existing.hra));
                      setAllowances(String(existing.allowances));
                      setPfDeduction(String(existing.pfDeduction));
                      setProfessionalTax(String(existing.professionalTax));
                      setTds(String(existing.tds));
                      setSignatureName(existing.signatureName ?? signatureName);
                      setSignatureTitle(existing.signatureTitle ?? signatureTitle);
                    }
                  }}
                  className="w-full brutal-border bg-brutal-white px-3 py-3 font-display font-bold text-sm uppercase"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>
                  ))}
                </select>
              </label>

              {[
                ['Basic', basic, setBasic],
                ['HRA', hra, setHra],
                ['Allowances', allowances, setAllowances],
                ['PF Deduction', pfDeduction, setPfDeduction],
                ['Professional Tax', professionalTax, setProfessionalTax],
                ['TDS', tds, setTds],
                ['Incentives', incentives, setIncentives],
                ['Extra Deductions', extraDeductions, setExtraDeductions],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="space-y-1">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{label as string}</span>
                  <input
                    value={value as string}
                    onChange={(e) => (setter as (next: string) => void)(e.target.value)}
                    type="number"
                    className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold"
                  />
                </label>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Month</span>
                  <input value={month} onChange={(e) => setMonth(e.target.value)} type="number" min="1" max="12" className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                </label>
                <label className="space-y-1">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Year</span>
                  <input value={year} onChange={(e) => setYear(e.target.value)} type="number" className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-1">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Signature Name</span>
                  <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                </label>
                <label className="space-y-1">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">Approval Title</span>
                  <input value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold" />
                </label>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['Base', baseTotal],
                  ['Deductions', totalDeductions],
                  ['Preview Net', previewNet],
                  ['Structure', selectedStructure ? 'Saved' : 'New'],
                ].map(([label, value]) => (
                  <div key={label as string} className="brutal-border bg-brutal-surface p-3">
                    <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{label as string}</p>
                    <p className="font-display font-bold text-lg">{typeof value === 'number' ? formatCurrency(value) : value}</p>
                  </div>
                ))}
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button
                  disabled={!selectedEmployeeId || saveStructure.isPending}
                  onClick={() => saveStructure.mutate()}
                  className="brutal-btn-secondary px-4 py-3 text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <ShieldCheck size={15} /> Save Salary Structure
                </button>
                <button
                  disabled={!selectedEmployeeId || generateSlip.isPending}
                  onClick={() => generateSlip.mutate()}
                  className="brutal-btn-primary px-4 py-3 text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <FileText size={15} /> Generate Slip
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Structures', adminStats.structures, 'bg-brutal-yellow'],
                ['Draft Slips', adminStats.drafts, 'bg-brutal-white'],
                ['Approved', adminStats.approved, 'bg-brutal-blue text-white'],
                ['Transferred', adminStats.transferred, 'bg-brutal-ink text-brutal-yellow'],
              ].map(([label, value, tone]) => (
                <div key={label as string} className={`brutal-border brutal-shadow p-4 ${tone}`}>
                  <p className="font-display font-bold text-[10px] uppercase tracking-widest opacity-70">{label as string}</p>
                  <p className="font-display font-bold text-3xl">{value as number}</p>
                </div>
              ))}
            </div>

            <div className="bg-brutal-white brutal-border brutal-shadow">
              <div className="px-4 py-3 brutal-border-b bg-brutal-ink text-white font-display font-bold text-xs uppercase tracking-[0.2em]">
                Approval Queue
              </div>
              <div className="divide-y-[3px] divide-brutal-ink">
                {adminSlips.slice(0, 5).map((slip) => (
                  <div key={slip.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold uppercase">{employeeLabel(slip.employee)}</p>
                        <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{monthLabel(slip)} / {formatCurrency(money(slip.netPayable))}</p>
                      </div>
                      <span className={`px-2 py-1 font-display font-bold text-[10px] uppercase tracking-widest border-2 border-brutal-ink ${
                        slip.status === 'TRANSFERRED' ? 'bg-brutal-ink text-brutal-yellow' :
                        slip.status === 'APPROVED' ? 'bg-brutal-blue text-white' : 'bg-brutal-yellow text-brutal-ink'
                      }`}>
                        {slip.status ?? 'DRAFT'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={slip.status === 'APPROVED' || slip.status === 'TRANSFERRED' || approveSlip.isPending}
                        onClick={() => approveSlip.mutate(slip.id)}
                        className="brutal-btn-secondary px-3 py-2 text-[10px] flex items-center gap-1 disabled:opacity-40"
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        disabled={slip.status === 'TRANSFERRED' || slip.status === 'REJECTED' || rejectSlip.isPending}
                        onClick={() => rejectSlip.mutate(slip.id)}
                        className="px-3 py-2 text-[10px] flex items-center gap-1 disabled:opacity-40 bg-brutal-red text-white brutal-border font-display font-bold uppercase tracking-widest"
                      >
                        Reject
                      </button>
                      <input
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="UTR / REF"
                        className="brutal-border bg-brutal-surface px-2 py-2 font-display font-bold text-[10px] uppercase w-28"
                      />
                      <button
                        disabled={slip.status !== 'APPROVED' || transferSlip.isPending}
                        onClick={() => transferSlip.mutate(slip.id)}
                        className="brutal-btn-primary px-3 py-2 text-[10px] flex items-center gap-1 disabled:opacity-40"
                      >
                        <Send size={13} /> Transfer
                      </button>
                    </div>
                  </div>
                ))}
                {adminSlips.length === 0 && (
                  <p className="p-6 text-center font-display font-bold uppercase text-[#4a4a4a]">No payroll slips yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Wallet, label: 'YTD Gross', value: formatCurrency(ytdGross), accent: 'yellow' as const },
          { icon: BarChart2, label: 'Deductions', value: formatCurrency(ytdDeductions), accent: undefined },
          { icon: CheckCircle2, label: 'YTD Net Pay', value: formatCurrency(ytdNet), accent: 'blue' as const },
          { icon: Mail, label: 'Payslips', value: mySlips.length, accent: undefined },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
            accent === 'yellow' ? 'bg-brutal-yellow' :
            accent === 'blue' ? 'bg-brutal-blue' : 'bg-brutal-white'
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

      {latest && (
        <section className="grid grid-cols-12 gap-0 brutal-border brutal-shadow-lg">
          {/* Left: net pay hero */}
          <div className="col-span-12 lg:col-span-7 p-5 sm:p-7 lg:p-9 relative">
            <div className="flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.22em]">
              <span className="px-2 py-1 bg-brutal-ink text-brutal-yellow">PAYSLIP</span>
              <span className="w-2 h-2 bg-brutal-blue" />
              <span className="text-brutal-ink/60">{monthLabel(latest).toUpperCase()}</span>
            </div>
            <div className="mt-5">
              <div className="font-display font-bold text-[11px] tracking-[0.22em] text-brutal-ink/60 uppercase">NET PAYABLE</div>
              <div className="mt-1 text-[44px] sm:text-[56px] lg:text-[72px] leading-[0.9] font-bold num tracking-[-0.03em]">
                {formatCurrency(money(latest.netPayable))}
              </div>
            </div>
            <div className="mt-7 grid grid-cols-3 gap-0 brutal-border">
              {[
                { l: 'GROSS',     v: formatCurrency(money(latest.grossSalary)),  bg: 'bg-brutal-yellow' },
                { l: 'DEDUCT',    v: formatCurrency(money(latest.deductions)),    bg: 'bg-brutal-surface' },
                { l: 'DAYS PAID', v: `${(latest as AdminSalarySlip & { daysPresent?: number }).daysPresent ?? 30}`, bg: 'bg-brutal-surface' },
              ].map((s, i) => (
                <div key={s.l} className={`p-4 ${i < 2 ? 'brutal-border-r' : ''} ${s.bg}`}>
                  <div className="font-display font-bold text-[10px] tracking-[0.22em] text-brutal-ink/60">{s.l}</div>
                  <div className="mt-1 font-bold text-[18px] sm:text-[22px] num">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button onClick={() => openPdf(latest.id)} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
                <Download size={15} /> DOWNLOAD PDF
              </button>
              <span className={`px-3 py-2 border-2 border-brutal-ink font-display font-bold text-[11px] tracking-[0.16em] uppercase ${
                latest.status === 'TRANSFERRED' ? 'bg-brutal-ink text-brutal-yellow' :
                latest.status === 'APPROVED'    ? 'bg-[#0F8F3A] text-white' :
                latest.status === 'REJECTED'    ? 'bg-brutal-red text-white' :
                'bg-brutal-yellow text-brutal-ink'
              }`}>
                {latest.status ?? 'DRAFT'}
              </span>
              {latest.paymentRef && (
                <div className="border-l-[3px] border-brutal-ink pl-4 font-display font-bold text-[11px] tracking-[0.14em]">
                  <div className="text-brutal-ink/60">REF</div>
                  <div className="text-[13px] num">{latest.paymentRef}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: component breakdown */}
          <div className="col-span-12 lg:col-span-5 lg:border-l-[4px] brutal-border-t lg:border-t-0 border-brutal-ink bg-brutal-ink text-white relative overflow-hidden">
            <div className="absolute inset-0 diag opacity-10" />
            <div className="relative p-6 h-full flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-brutal-yellow text-brutal-ink px-2 py-1 border-2 border-brutal-yellow">COMPONENTS</span>
                <span className="font-display font-bold text-[10px] tracking-[0.18em] text-white/60">{latest.signatureName ?? 'AUTHORIZED'}</span>
              </div>
              <div className="mt-6 space-y-5 flex-1">
                {[
                  { l: 'BASIC',      v: money(latest.baseSalary) || Math.round(money(latest.grossSalary) * 0.5),    color: 'bg-brutal-yellow',  ref: money(latest.grossSalary) },
                  { l: 'HRA',        v: Math.round(money(latest.grossSalary) * 0.2),                                color: 'bg-brutal-blue',    ref: money(latest.grossSalary) },
                  { l: 'SPECIAL',    v: Math.round(money(latest.grossSalary) * 0.2),                                color: 'bg-white',          ref: money(latest.grossSalary) },
                  { l: 'DEDUCTIONS', v: money(latest.deductions),                                                   color: 'bg-brutal-red',     ref: money(latest.grossSalary) },
                ].map(item => (
                  <div key={item.l}>
                    <div className="flex justify-between font-display font-bold text-[11px] tracking-[0.14em] mb-1.5">
                      <span className="text-white/70">{item.l}</span>
                      <span className="text-white num">{formatCurrency(item.v)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 border border-white/15">
                      <div className={`h-full ${item.color}`} style={{ width: `${Math.min((item.v / Math.max(item.ref, 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between font-display font-bold text-[11px] tracking-[0.14em]">
                <span className="text-white/60">{latest.signatureTitle ?? 'PAYROLL'}</span>
                <span className="text-brutal-yellow">{monthLabel(latest).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="brutal-border brutal-shadow overflow-hidden">
        <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center justify-between">
          <span className="font-display font-bold text-[11px] tracking-[0.22em]">PAYSLIP HISTORY</span>
          <span className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-cream/60">GENERATED · APPROVED · TRANSFERRED</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-brutal-surface animate-pulse" />)}
          </div>
        ) : mySlips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-display font-bold text-[11px] tracking-[0.22em] text-brutal-ink/50">NO PAYSLIPS YET · CONTACT HR</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[1fr_140px_140px_140px_140px_60px_100px] font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-surface brutal-border-b">
                {['PERIOD', 'GROSS', 'DEDUCT', 'NET PAY', 'STATUS', 'LOP', 'DOWNLOAD'].map(h => (
                  <div key={h} className="px-4 py-2.5 border-r-[2px] border-brutal-ink/20 last:border-r-0 text-brutal-ink/60">{h}</div>
                ))}
              </div>
              {mySlips.map((p, i) => (
                <div key={p.id} className={`grid grid-cols-[1fr_140px_140px_140px_140px_60px_100px] items-center font-display font-bold text-[12px] ${i < mySlips.length - 1 ? 'brutal-border-b' : ''} hover:bg-brutal-surface transition-colors`}>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10 tracking-[0.06em]">{monthLabel(p).toUpperCase()}</div>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10 num text-[11px]">{formatCurrency(money(p.grossSalary))}</div>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10 num text-[11px] text-brutal-red">{formatCurrency(money(p.deductions))}</div>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10 num text-[11px] text-brutal-blue font-bold">{formatCurrency(money(p.netPayable))}</div>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10">
                    <span className={`px-2 py-[3px] border-2 border-brutal-ink text-[10px] tracking-[0.12em] uppercase ${
                      p.status === 'TRANSFERRED' ? 'bg-brutal-ink text-brutal-yellow' :
                      p.status === 'APPROVED'    ? 'bg-[#0F8F3A] text-white' :
                      p.status === 'REJECTED'    ? 'bg-brutal-red text-white' :
                      'bg-brutal-yellow text-brutal-ink'
                    }`}>{p.status ?? 'DRAFT'}</span>
                  </div>
                  <div className="px-4 py-3 border-r-[2px] border-brutal-ink/10 num text-[11px] text-brutal-ink/50">
                    {(p as AdminSalarySlip & { lopDays?: number }).lopDays ?? 0}
                  </div>
                  <div className="px-4 py-3">
                    <button onClick={() => openPdf(p.id)} className="flex items-center gap-1 font-display font-bold text-[10px] tracking-[0.12em] px-2 py-1.5 border-2 border-brutal-ink hover:bg-brutal-yellow transition-colors">
                      <Download size={11} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
