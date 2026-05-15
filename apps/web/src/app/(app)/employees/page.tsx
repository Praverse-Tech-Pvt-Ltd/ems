'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import type { Employee } from '@/types';
import { Search, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE:   'bg-brutal-surface border-brutal-ink text-brutal-ink',
  MANAGER:    'bg-brutal-blue border-brutal-ink text-white',
  ADMIN:      'bg-brutal-ink border-brutal-ink text-brutal-yellow',
  SUPER_ADMIN:'bg-brutal-red border-brutal-ink text-white',
};

export default function EmployeesPage() {
  const isAdmin = useIsAdmin();
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', search],
    queryFn: () => apiClient.get(`/employees?search=${search}`).then((r) => r.data),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-brutal-red brutal-border brutal-shadow flex items-center justify-center mb-6">
          <Shield size={32} className="text-white" />
        </div>
        <h2 className="font-display font-bold text-3xl uppercase tracking-tight text-brutal-ink mb-3">
          Access Restricted
        </h2>
        <p className="font-body text-[#4a4a4a] text-sm">This page is only accessible to Admin and Manager roles.</p>
      </div>
    );
  }

  const roles    = ['All', 'EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];
  const filtered = employees.filter((e) => roleFilter === 'All' || e.role === roleFilter);

  const active      = employees.filter((e) => e.status === 'ACTIVE').length;
  const faceEnrolled = employees.filter((e) => e.faceEnrolled).length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
          Employee<br />
          <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Directory</span>
        </h1>
        <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
          Manage your workforce
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users,     label: 'Total Employees', value: employees.length },
          { icon: UserCheck, label: 'Active',           value: active,                          accent: 'yellow' as const },
          { icon: UserX,     label: 'Face Enrolled',    value: `${faceEnrolled}/${employees.length}`, accent: 'blue' as const },
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
              <p className={`font-display font-bold text-2xl ${accent === 'blue' ? 'text-white' : 'text-brutal-ink'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Role filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or code..."
            className="pl-9 pr-4 py-2.5 text-sm brutal-border bg-brutal-cream focus:outline-none font-body w-full"
          />
        </div>
        <div className="flex items-center gap-1 bg-brutal-surface brutal-border p-1">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={clsx(
                'px-3 py-1.5 font-display font-bold text-xs uppercase tracking-wide transition-colors',
                roleFilter === r ? 'bg-brutal-ink text-brutal-yellow' : 'text-[#4a4a4a] hover:bg-brutal-surface-hi',
              )}
            >
              {r === 'All' ? 'All' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-brutal-surface animate-pulse brutal-border" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-brutal-white brutal-border brutal-shadow p-12 text-center">
          <p className="font-display font-bold uppercase text-[#4a4a4a]">No employees found.</p>
        </div>
      ) : (
        <div className="bg-brutal-white brutal-border brutal-shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brutal-surface brutal-border-b">
                {['Employee', 'Code', 'Department', 'Role', 'Joined', 'Face ID'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-display font-bold text-xs uppercase tracking-wide text-[#4a4a4a]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} className={`border-b-2 border-brutal-surface hover:bg-brutal-surface-lo transition-colors ${i % 2 !== 0 ? 'bg-brutal-surface-lo/50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brutal-ink border-2 border-brutal-ink flex items-center justify-center text-brutal-yellow font-display font-bold text-xs flex-shrink-0">
                        {e.firstName[0]}{e.lastName[0]}
                      </div>
                      <div>
                        <p className="font-display font-bold text-sm uppercase">{e.firstName} {e.lastName}</p>
                        <p className="font-body text-xs text-[#4a4a4a]">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#4a4a4a] font-bold">{e.employeeCode}</td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a]">{e.department?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 text-xs font-display font-bold uppercase border-2 ${ROLE_COLORS[e.role] ?? ROLE_COLORS.EMPLOYEE}`}>
                      {e.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-body text-[#4a4a4a] text-xs">{formatDate(e.joiningDate)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-display font-bold uppercase ${e.faceEnrolled ? 'text-brutal-blue' : 'text-brutal-red'}`}>
                      {e.faceEnrolled ? '✓ Enrolled' : '✗ Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
