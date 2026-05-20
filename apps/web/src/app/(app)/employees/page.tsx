'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { initials } from '@/lib/utils';
import type { Employee } from '@/types';
import { Search, Plus } from 'lucide-react';

const TONE_CYCLE = ['blue', null, null, 'yellow', null, null, 'red'] as const;

export default function EmployeesPage() {
  const [q, setQ] = useState('');
  const me = useAuthStore(s => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/employees').then(r => r.data).catch(() => []),
  });

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
            <button className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
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
              <div key={e.id} style={{ animationDelay: `${i * 30}ms` }}
                className={`animate-fade-up brutal-border brutal-shadow-sm hover:brutal-shadow hover:-translate-x-px hover:-translate-y-px transition-all ${e.status === 'INACTIVE' || e.status === 'TERMINATED' ? 'opacity-60' : ''}`}>
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
              </div>
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
    </div>
  );
}
