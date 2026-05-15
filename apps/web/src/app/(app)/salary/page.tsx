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
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <p className="font-display font-bold text-xs uppercase tracking-[0.35em] text-[#4a4a4a] mb-3">Payroll Control / Salary Desk</p>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Payroll &amp;<br />
            <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Salary</span>
          </h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-brutal-ink text-white brutal-border brutal-shadow p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="font-display font-bold text-xs uppercase tracking-widest text-brutal-yellow mb-1">Latest Payslip</p>
                <h2 className="font-display font-bold text-3xl uppercase">{monthLabel(latest)}</h2>
              </div>
              <button onClick={() => openPdf(latest.id)} className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-2">
                <Download size={14} /> PDF
              </button>
            </div>
            {[
              { label: 'Base Salary', value: money(latest.baseSalary) || money(latest.grossSalary), color: 'bg-brutal-yellow' },
              { label: 'Incentives + Claims', value: money(latest.incentives) + money(latest.reimbursements), color: 'bg-brutal-blue' },
              { label: 'Deductions', value: money(latest.deductions), color: 'bg-brutal-red' },
            ].map(({ label, value, color }) => (
              <div key={label} className="mb-5">
                <div className="flex justify-between font-display font-bold text-sm uppercase mb-2">
                  <span className="text-white/70">{label}</span>
                  <span className="text-white">{formatCurrency(value)}</span>
                </div>
                <div className="w-full h-3 bg-white/10 border border-white/20">
                  <div className={`h-full ${color}`} style={{ width: `${Math.min((value / Math.max(money(latest.grossSalary), 1)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-brutal-white brutal-border brutal-shadow p-6">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4">Approval Snapshot</h3>
            <div className="space-y-3">
              {[
                ['Status', latest.status ?? 'DRAFT'],
                ['Net Payable', formatCurrency(money(latest.netPayable))],
                ['Signature', latest.signatureName ?? 'Pending'],
                ['Transfer Ref', latest.paymentRef ?? 'Pending'],
                ['Employee Mail', latest.emailSentAt ? 'Sent' : 'Queued after transfer'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="font-body text-sm text-[#4a4a4a]">{label}</span>
                  <span className="font-display font-bold text-sm text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-brutal-white brutal-border brutal-shadow overflow-x-auto">
        <div className="px-6 py-4 brutal-border-b flex items-center justify-between">
          <h3 className="font-display font-bold text-lg uppercase">Payslip History</h3>
          <span className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[#4a4a4a]">Generated / Approved / Transferred</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-brutal-surface animate-pulse" />)}
          </div>
        ) : mySlips.length === 0 ? (
          <p className="px-6 py-10 text-center font-display font-bold uppercase text-[#4a4a4a]">No payslips found.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-brutal-surface brutal-border-b">
                {['Period', 'Gross', 'Incentives', 'Deductions', 'Net Pay', 'Status', 'Download'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold text-xs uppercase tracking-wide text-[#4a4a4a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mySlips.map((p, i) => (
                <tr key={p.id} className={`border-b-2 border-brutal-surface ${i % 2 !== 0 ? 'bg-brutal-surface-lo' : ''}`}>
                  <td className="px-5 py-3 font-display font-bold uppercase">{monthLabel(p)}</td>
                  <td className="px-5 py-3 font-body">{formatCurrency(money(p.grossSalary))}</td>
                  <td className="px-5 py-3 font-body">{formatCurrency(money(p.incentives) + money(p.reimbursements))}</td>
                  <td className="px-5 py-3 font-body text-brutal-red">{formatCurrency(money(p.deductions))}</td>
                  <td className="px-5 py-3 font-display font-bold text-brutal-blue">{formatCurrency(money(p.netPayable))}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 border-2 border-brutal-ink bg-brutal-yellow font-display font-bold text-[10px] uppercase tracking-widest">
                      {p.status ?? 'DRAFT'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => openPdf(p.id)} className="flex items-center gap-1.5 brutal-btn-secondary px-3 py-1.5 text-xs">
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
