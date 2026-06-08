'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { employeesService } from '@/lib/api/employees';
import { useAuthStore } from '@/store/auth.store';
import type { Employee, Department } from '@/types';

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-error/10 text-error border-error/20',
  ADMIN: 'bg-primary/10 text-primary border-primary/20',
  MANAGER: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  EMPLOYEE: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  INACTIVE: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
  TERMINATED: 'bg-error/10 text-error border-error/20',
};

export default function EmployeeDirectoryPage() {
  const router  = useRouter();
  const user    = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const load = async () => {
    try {
      const [emps, depts] = await Promise.all([
        employeesService.list().catch(() => []),
        employeesService.departments().catch(() => []),
      ]);
      setEmployees(Array.isArray(emps) ? emps : emps?.data ?? []);
      setDepartments(Array.isArray(depts) ? depts : depts?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      `${e.firstName} ${e.lastName} ${e.email} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || e.department?.id === deptFilter;
    return matchSearch && matchDept;
  });

  const initials = (e: Employee) => `${e.firstName[0]}${e.lastName[0]}`.toUpperCase();

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">badge</span>
          PEOPLE
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Employee Directory</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Employee Directory</h2>
            <p className="text-on-surface-variant mt-xs">Browse all employees across departments.</p>
          </div>
          {isAdmin && (
            <button className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 shrink-0">
              <span className="material-symbols-outlined text-[16px]">person_add</span>Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {[
            { label: 'Total', value: employees.length, color: 'text-primary', icon: 'group' },
            { label: 'Active', value: employees.filter(e => e.status === 'ACTIVE').length, color: 'text-tertiary', icon: 'how_to_reg' },
            { label: 'Admins / Managers', value: employees.filter(e => ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(e.role)).length, color: 'text-error', icon: 'admin_panel_settings' },
            { label: 'Departments', value: departments.length, color: 'text-on-surface', icon: 'corporate_fare' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex items-center gap-md card-hover">
              <span className={`material-symbols-outlined text-[28px] ${s.color}`}>{s.icon}</span>
              <div>
                <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-body-sm text-on-surface-variant">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-sm items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or code..."
            className="w-full pl-9 pr-sm py-2.5 border border-outline-variant/50 rounded-xl text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
        </div>
        <div className="flex gap-xs flex-wrap">
          <button onClick={() => setDeptFilter('')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-label-caps border transition-all ${!deptFilter ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
            All
          </button>
          {departments.map(d => (
            <button key={d.id} onClick={() => setDeptFilter(d.id === deptFilter ? '' : d.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-label-caps border transition-all ${deptFilter === d.id ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-xs">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          {search || deptFilter ? 'No employees match your filters.' : 'No employees found.'}
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-sm px-md py-2 bg-surface-container-low border-b border-outline-variant/20">
            {['Employee', 'Department', 'Role', 'Status', ''].map(h => (
              <span key={h} className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-outline-variant/20">
            {filtered.map(emp => (
              <div
                key={emp.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-sm items-center p-sm hover:bg-surface-container-low transition-colors group cursor-pointer"
                onClick={() => router.push(`/employee-profile/${emp.id}`)}
              >
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm shrink-0">
                    {initials(emp)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[10px] text-on-surface-variant truncate">{emp.designation ?? emp.email} · {emp.employeeCode}</p>
                  </div>
                </div>
                <p className="text-body-sm text-on-surface-variant">{emp.department?.name ?? '—'}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${ROLE_COLOR[emp.role]}`}>{emp.role}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${STATUS_COLOR[emp.status]}`}>{emp.status}</span>
                <div className="flex gap-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/employee-profile/${emp.id}`)}
                    className="text-on-surface-variant hover:text-primary transition-colors p-1"
                    title="View profile"
                  >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                  {isAdmin && (
                    <button className="text-on-surface-variant hover:text-primary transition-colors p-1" title="Edit">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
