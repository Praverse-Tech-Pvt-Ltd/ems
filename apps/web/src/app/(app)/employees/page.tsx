'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { initials } from '@/lib/utils';
import type { Employee } from '@/types';
import { Search, Plus, X, Copy, Check } from 'lucide-react';
import Link from 'next/link';

const TONE_CYCLE = ['blue', null, null, 'yellow', null, null, 'red'] as const;

export default function EmployeesPage() {
  const [q, setQ] = useState('');
  const me = useAuthStore(s => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{ employee: Employee; tempPassword?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    joiningDate: new Date().toISOString().split('T')[0],
    phone: '',
    departmentId: '',
    designation: '',
    role: 'EMPLOYEE',
    managerId: '',
    salaryGrade: '',
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/employees').then(r => r.data).catch(() => []),
  });

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/employees/departments').then(r => r.data).catch(() => []),
  });

  const createEmployee = useMutation({
    mutationFn: (data: any) => apiClient.post('/employees', data).then(r => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessData(res);
      setForm({
        email: '',
        firstName: '',
        lastName: '',
        joiningDate: new Date().toISOString().split('T')[0],
        phone: '',
        departmentId: '',
        designation: '',
        role: 'EMPLOYEE',
        managerId: '',
        salaryGrade: '',
      });
      setErrorMsg('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create employee';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const managers = useMemo(() => {
    return employees.filter(e => e.role === 'MANAGER' || e.role === 'ADMIN' || e.role === 'SUPER_ADMIN');
  }, [employees]);

  const depts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      const d = e.department?.name ?? 'UNASSIGNED';
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([l, v]) => ({ l, v }));
  }, [employees]);

  const filtered = useMemo(() =>
    employees.filter(e =>
      !q || (`${e.firstName} ${e.lastName} ${e.designation ?? ''} ${e.department?.name ?? ''} ${e.employeeCode}`)
        .toLowerCase().includes(q.toLowerCase())
    ),
    [employees, q]
  );

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— EMPLOYEES / 07</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-yellow px-2">{isLoading ? '—' : employees.length}</span> ON STAFF<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            DIRECTORY · {depts.length} DEPARTMENT{depts.length !== 1 ? 'S' : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-stretch brutal-border brutal-shadow-sm">
            <div className="px-3 grid place-items-center brutal-border-r"><Search size={14} /></div>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="NAME · ROLE · DEPT"
              className="px-3 py-2 bg-transparent focus:outline-none font-display font-bold text-[12px] tracking-[0.12em] w-48"
            />
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
              <Plus size={15} /> ADD EMPLOYEE
            </button>
          )}
        </div>
      </div>

      {/* Department strip */}
      {depts.length > 0 && (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(depts.length, 5)} gap-0 brutal-border brutal-shadow`}>
          {depts.slice(0, 5).map((d, i) => (
            <div key={d.l} className={`p-4 ${i < depts.length - 1 && i < 4 ? 'md:brutal-border-r' : ''} ${i === 0 ? 'bg-brutal-blue text-white' : 'bg-brutal-cream'}`}>
              <div className="font-display font-bold text-[10px] tracking-[0.2em]">{d.l}</div>
              <div className="mt-1.5 text-[32px] font-bold num leading-none">{d.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="brutal-border diag bg-brutal-cream p-12 text-center">
          <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
            LOADING DIRECTORY…
          </div>
        </div>
      )}

      {/* Cards grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e, i) => {
            const isSelf = e.id === me?.id;
            const tone = TONE_CYCLE[i % TONE_CYCLE.length];
            const avatarBg =
              isSelf        ? 'bg-brutal-yellow text-brutal-ink' :
              tone === 'blue'   ? 'bg-brutal-blue text-white' :
              tone === 'yellow' ? 'bg-brutal-yellow text-brutal-ink' :
              tone === 'red'    ? 'bg-brutal-red text-white' :
              'bg-brutal-ink text-brutal-yellow';
            const statusBg =
              e.status === 'ACTIVE'     ? 'bg-[#0F8F3A] text-white' :
              e.status === 'TERMINATED' ? 'bg-brutal-red text-white' :
              'bg-brutal-yellow text-brutal-ink';
            const sinceYear = e.joiningDate ? new Date(e.joiningDate).getFullYear() : '—';
            return (
              <Link href={`/employees/${e.id}`} key={e.id} style={{ animationDelay: `${i * 30}ms` }}
                className={`animate-fade-up brutal-border brutal-shadow-sm hover:brutal-shadow hover:-translate-x-px hover:-translate-y-px transition-all cursor-pointer block ${e.status === 'INACTIVE' || e.status === 'TERMINATED' ? 'opacity-60' : ''}`}>
                <div className="flex items-stretch">
                  <div className={`w-20 shrink-0 grid place-items-center text-[28px] font-bold font-display brutal-border-r ${avatarBg}`}>
                    {initials(e.firstName, e.lastName)}
                  </div>
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{e.employeeCode}</span>
                      {isSelf && <span className="font-display font-bold text-[9px] px-1 py-0.5 bg-brutal-yellow border-2 border-brutal-ink">YOU</span>}
                    </div>
                    <div className="mt-1 text-[16px] font-bold tracking-tight truncate">{e.firstName} {e.lastName}</div>
                    <div className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/60 mt-1">{(e.designation ?? e.role).toUpperCase()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 brutal-border-t">
                  <div className="px-3 py-2 brutal-border-r">
                    <div className="font-display font-bold text-[9px] tracking-[0.18em] text-brutal-ink/60">DEPT</div>
                    <div className="font-display font-bold text-[11px] tracking-[0.12em] truncate">{(e.department?.name ?? '—').toUpperCase()}</div>
                  </div>
                  <div className="px-3 py-2 brutal-border-r">
                    <div className="font-display font-bold text-[9px] tracking-[0.18em] text-brutal-ink/60">SINCE</div>
                    <div className="font-display font-bold text-[11px] tracking-[0.12em] num">{sinceYear}</div>
                  </div>
                  <div className={`px-3 py-2 ${statusBg}`}>
                    <div className="font-display font-bold text-[9px] tracking-[0.18em] opacity-80">STATUS</div>
                    <div className="font-display font-bold text-[11px] tracking-[0.12em]">{e.status}</div>
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full brutal-border diag bg-brutal-cream p-12 text-center">
              <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
                NO EMPLOYEES FOUND
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brutal-ink/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-brutal-cream brutal-border brutal-shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAddModal(false);
                setSuccessData(null);
                setErrorMsg('');
              }}
              className="absolute top-4 right-4 p-1 brutal-border bg-brutal-surface hover:bg-brutal-red hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {successData ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 bg-brutal-yellow brutal-border flex items-center justify-center mx-auto">
                  <Check size={24} className="text-brutal-ink" />
                </div>
                <h3 className="font-display font-bold text-xl uppercase">Employee Onboarded Successfully!</h3>
                <p className="font-display text-xs text-brutal-ink/70">
                  The account has been created. Provide the following temporary password to the employee to log in.
                </p>

                <div className="p-4 brutal-border bg-brutal-surface font-mono font-bold text-lg flex items-center justify-between gap-4 mt-2">
                  <span className="select-all">{successData.tempPassword}</span>
                  <button
                    onClick={() => {
                      if (successData.tempPassword) {
                        navigator.clipboard.writeText(successData.tempPassword);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="p-2 brutal-border bg-brutal-yellow hover:bg-white text-xs font-display uppercase font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <Copy size={14} /> {copied ? 'COPIED' : 'COPY'}
                  </button>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSuccessData(null);
                    }}
                    className="brutal-btn-primary px-6 py-2.5 text-xs w-full"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Clean payloads for database insertion
                  const payload = {
                    ...form,
                    departmentId: form.departmentId || undefined,
                    managerId: form.managerId || undefined,
                    phone: form.phone || undefined,
                    salaryGrade: form.salaryGrade || undefined,
                    designation: form.designation || undefined,
                  };
                  createEmployee.mutate(payload);
                }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display font-bold text-xl uppercase">Add New Employee</h2>
                  <p className="font-display font-bold text-[10px] tracking-wider text-brutal-ink/50 mt-1 uppercase">
                    Provide basic information to create employee file
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 brutal-border bg-brutal-red text-white text-xs font-display font-bold uppercase">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block col-span-2">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Email Address *</span>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="employee@nexgen.in"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">First Name *</span>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={e => setForm({ ...form, firstName: e.target.value })}
                      placeholder="Jane"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Last Name *</span>
                    <input
                      type="text"
                      required
                      value={form.lastName}
                      onChange={e => setForm({ ...form, lastName: e.target.value })}
                      placeholder="Doe"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Phone</span>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="+919876543210"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Joining Date *</span>
                    <input
                      type="date"
                      required
                      value={form.joiningDate}
                      onChange={e => setForm({ ...form, joiningDate: e.target.value })}
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Department</span>
                    <select
                      value={form.departmentId}
                      onChange={e => setForm({ ...form, departmentId: e.target.value })}
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Designation</span>
                    <input
                      type="text"
                      value={form.designation}
                      onChange={e => setForm({ ...form, designation: e.target.value })}
                      placeholder="Software Engineer"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Role</span>
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Manager</span>
                    <select
                      value={form.managerId}
                      onChange={e => setForm({ ...form, managerId: e.target.value })}
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    >
                      <option value="">Select Manager</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block col-span-2">
                    <span className="font-display font-bold text-[10px] uppercase tracking-wider text-brutal-ink/70">Salary Grade</span>
                    <input
                      type="text"
                      value={form.salaryGrade}
                      onChange={e => setForm({ ...form, salaryGrade: e.target.value })}
                      placeholder="e.g. INTERN, PERMANENT"
                      className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-xs focus:outline-none"
                    />
                  </label>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={createEmployee.isPending}
                    className="brutal-btn-primary px-6 py-3 text-xs flex-1 flex items-center justify-center gap-2"
                  >
                    {createEmployee.isPending ? 'ONBOARDING…' : 'ONBOARD EMPLOYEE'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setErrorMsg('');
                    }}
                    className="brutal-btn-secondary px-6 py-3 text-xs"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
