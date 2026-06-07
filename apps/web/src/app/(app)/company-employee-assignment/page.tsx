'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { clientsService } from '@/lib/api/clients';
import { employeesService } from '@/lib/api/employees';

type Company = {
  id: string;
  name: string;
  shortName?: string;
  businessStatus: string;
  criticality: string;
  riskScore?: number;
  responsibleEmployee?: { id: string; firstName: string; lastName: string; designation?: string } | null;
  responsibleEmployeeId?: string | null;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  designation?: string;
  role: string;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  DELAYED:  'bg-amber-50 text-amber-700 border-amber-200',
  AT_RISK:  'bg-rose-50 text-rose-700 border-rose-200',
  LOST:     'bg-slate-100 text-slate-600 border-slate-200',
  DORMANT:  'bg-slate-50 text-slate-500 border-slate-200',
};

const CRITICALITY_DOT: Record<string, string> = {
  HIGH:   'bg-rose-500',
  MEDIUM: 'bg-amber-400',
  LOW:    'bg-emerald-400',
};

export default function CompanyEmployeeAssignmentPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [saved,      setSaved]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('ALL');

  useEffect(() => {
    Promise.all([
      clientsService.list().catch(() => []),
      employeesService.list().catch(() => []),
    ]).then(([comp, emp]) => {
      const compArr = Array.isArray(comp) ? comp : comp?.data ?? [];
      const empArr  = Array.isArray(emp)  ? emp  : emp?.data  ?? [];
      setCompanies(compArr);
      setEmployees(empArr);
    }).finally(() => setLoading(false));
  }, []);

  const handleAssign = async (companyId: string, employeeId: string) => {
    setSaving(companyId);
    try {
      await clientsService.update(companyId, { responsibleEmployeeId: employeeId || null });
      setSaved(companyId);
      setCompanies(prev => prev.map(c =>
        c.id === companyId
          ? {
              ...c,
              responsibleEmployeeId: employeeId || null,
              responsibleEmployee: employees.find(e => e.id === employeeId) ?? null,
            }
          : c,
      ));
      setTimeout(() => setSaved(null), 2000);
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-md text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">lock</span>
        <p className="text-on-surface-variant">This page is only accessible to Super Admins.</p>
      </div>
    );
  }

  const visible = companies.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || c.businessStatus === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
          ADMIN — COMPANY ASSIGNMENT
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Assign Employees to Companies</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Company Assignment</h2>
            <p className="text-on-surface-variant mt-xs">
              Set the responsible employee for each client company. Assignments are visible on all employee calendars.
            </p>
          </div>
          <div className="flex items-center gap-xs text-body-sm text-on-surface-variant glass-card px-3 py-1.5 rounded-full border border-outline-variant/30">
            <span className="material-symbols-outlined text-[14px]">domain</span>
            {companies.length} companies
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-outline-variant/50 bg-surface-container-lowest text-body-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-xs flex-wrap">
          {['ALL', 'ACTIVE', 'DELAYED', 'AT_RISK', 'DORMANT'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-label-caps text-[10px] px-3 py-1.5 rounded-full border transition-all ${
                filter === f
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-sm">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          No companies match your filter.
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {visible.map(company => {
            const currentId = company.responsibleEmployee?.id ?? company.responsibleEmployeeId ?? '';
            const isSavingThis = saving === company.id;
            const isSavedThis  = saved  === company.id;

            return (
              <div
                key={company.id}
                className="glass-card rounded-xl border border-outline-variant/30 px-md py-sm flex flex-col sm:flex-row sm:items-center gap-sm"
              >
                {/* Company info */}
                <div className="flex items-center gap-sm flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${CRITICALITY_DOT[company.criticality] ?? 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-sm truncate">{company.name}</p>
                    <div className="flex items-center gap-xs mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[company.businessStatus] ?? 'bg-surface-container text-on-surface-variant border-outline-variant/30'}`}>
                        {company.businessStatus}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">{company.criticality} criticality</span>
                      {(company.riskScore ?? 0) > 50 && (
                        <span className="text-[10px] text-rose-600 font-semibold">Risk {company.riskScore}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current assignment display */}
                <div className="hidden lg:flex items-center gap-xs text-body-sm text-on-surface-variant min-w-[160px]">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  <span className="truncate text-[11px]">
                    {company.responsibleEmployee
                      ? `${company.responsibleEmployee.firstName} ${company.responsibleEmployee.lastName}`
                      : currentId
                        ? employees.find(e => e.id === currentId)
                            ? `${employees.find(e => e.id === currentId)!.firstName} ${employees.find(e => e.id === currentId)!.lastName}`
                            : 'Assigned'
                        : 'Unassigned'}
                  </span>
                </div>

                {/* Assign dropdown */}
                <div className="flex items-center gap-xs flex-shrink-0">
                  <select
                    value={currentId}
                    onChange={e => handleAssign(company.id, e.target.value)}
                    disabled={isSavingThis}
                    className="border border-outline-variant/50 rounded-lg px-3 py-1.5 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none text-on-surface min-w-[180px] disabled:opacity-60"
                  >
                    <option value="">— Unassigned —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} {emp.designation ? `(${emp.designation})` : ''}
                      </option>
                    ))}
                  </select>

                  {isSavingThis && (
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSavedThis && (
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
