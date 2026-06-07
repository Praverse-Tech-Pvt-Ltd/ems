'use client';

import { useEffect, useState } from 'react';
import { clientsService, followUpService } from '@/lib/api/clients';
import { employeesService } from '@/lib/api/employees';

const gapCategories = [
  { label: 'Document Compliance', score: 62, gaps: 5, icon: 'description', color: 'text-error', bar: 'bg-error', actions: ['Upload renewal form', 'Request ISO certificate', 'Verify audit pack'] },
  { label: 'Communication Log', score: 88, gaps: 1, icon: 'forum', color: 'text-tertiary', bar: 'bg-tertiary', actions: ['Log last call notes'] },
  { label: 'Client Visits', score: 45, gaps: 8, icon: 'directions_car', color: 'text-error', bar: 'bg-error', actions: ['Schedule Q2 visit', 'Assign field rep', 'Follow up last visit'] },
  { label: 'Invoice Clearance', score: 79, gaps: 2, icon: 'receipt_long', color: 'text-primary', bar: 'bg-primary', actions: ['Remind Jun payment', 'Verify May invoice'] },
  { label: 'Regulatory Filings', score: 95, gaps: 0, icon: 'policy', color: 'text-tertiary', bar: 'bg-tertiary', actions: [] },
  { label: 'Delivery Milestones', score: 71, gaps: 3, icon: 'local_shipping', color: 'text-primary', bar: 'bg-primary', actions: ['Q2 report pending', 'Update delivery log'] },
];

const overallGapScore = Math.round(gapCategories.reduce((s, c) => s + c.score, 0) / gapCategories.length);

export default function ClientDetailGapAnalysisPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState('All Clients');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignNote, setAssignNote] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([clientsService.list().catch(() => []), employeesService.list().catch(() => [])]).then(([c, e]) => {
      setCompanies(Array.isArray(c) ? c : c?.data ?? []);
      setEmployees(Array.isArray(e) ? e : e?.data ?? []);
    });
  }, []);

  const clientNames = ['All Clients', ...companies.map((c: any) => c.name)];
  const selectedCompany = companies.find((c: any) => c.name === selected);

  async function handleAssign(actionLabel: string) {
    if (!assignEmployeeId) return;
    const company = selectedCompany ?? companies[0];
    if (!company) return;
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await followUpService.create({
        companyId: company.id,
        assignedTo: assignEmployeeId,
        dueDate,
        reason: actionLabel,
      });
      const employee = employees.find((e: any) => e.id === assignEmployeeId);
      setAssignNote(`Assigned "${actionLabel}" to ${employee?.firstName ?? employee?.name ?? 'team member'} for ${company.name} — they've been notified.`);
    } catch {
      setAssignNote('Could not create the assignment — please try again.');
    } finally {
      setAssigning(null);
      setAssignEmployeeId('');
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">rule_settings</span>
          CLIENT INTEL
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Gap Analysis</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Gap Analysis</h2>
            <p className="text-on-surface-variant mt-xs">Client-level gap scoring across documents, visits, comms, and compliance.</p>
          </div>
          {/* Client selector */}
          <div className="flex gap-xs flex-wrap shrink-0">
            {clientNames.map(c => (
              <button key={c} onClick={() => setSelected(c)}
                className={`px-3 py-1.5 rounded-full text-label-caps font-label-caps text-[11px] border transition-all ${selected === c ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {assignNote && (
        <div className="rounded-xl border border-tertiary/30 bg-tertiary/10 px-md py-sm flex items-center gap-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-tertiary text-[18px]">task_alt</span>
          <span className="flex-1">{assignNote}</span>
          <button onClick={() => setAssignNote(null)} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Overall score banner */}
      <div className={`rounded-2xl p-lg flex items-center gap-lg border ${overallGapScore >= 80 ? 'bg-tertiary/5 border-tertiary/20' : overallGapScore >= 60 ? 'bg-primary/5 border-primary/20' : 'bg-error/5 border-error/20'}`}>
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" strokeWidth="6" stroke="currentColor" className="text-surface-container-highest" />
            <circle cx="40" cy="40" r="32" fill="none" strokeWidth="6" stroke="currentColor"
              strokeDasharray={`${(overallGapScore / 100) * 201} 201`} strokeLinecap="round"
              className={overallGapScore >= 80 ? 'text-tertiary' : overallGapScore >= 60 ? 'text-primary' : 'text-error'} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black text-on-surface text-xl">{overallGapScore}</span>
            <span className="text-[9px] text-on-surface-variant">/ 100</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="font-title-lg text-on-surface font-bold">Overall Client Health Score</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            {gapCategories.reduce((s, c) => s + c.gaps, 0)} gaps identified across {gapCategories.filter(c => c.gaps > 0).length} categories. Highest risk: visits and document compliance.
          </p>
          <div className="flex gap-sm mt-sm">
            <button className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-3 py-1.5 rounded-full text-[11px] hover:opacity-90">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>AI Action Plan
            </button>
            <button className="flex items-center gap-xs text-label-caps font-label-caps border border-outline-variant px-3 py-1.5 rounded-full text-[11px] text-on-surface-variant hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-[14px]">download</span>Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Category scorecards */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">CATEGORY GAPS</p>
        <div className="flex flex-col gap-sm">
          {gapCategories.map(cat => (
            <div key={cat.label} className="glass-card rounded-xl border border-outline-variant/30 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === cat.label ? null : cat.label)}
                className="w-full p-sm flex items-center gap-md hover:bg-surface-container-low transition-colors"
              >
                <span className={`material-symbols-outlined ${cat.color}`}>{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-on-surface text-sm">{cat.label}</p>
                    <div className="flex items-center gap-sm">
                      {cat.gaps > 0 && (
                        <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full border border-error/20">{cat.gaps} gaps</span>
                      )}
                      <span className={`font-bold text-sm ${cat.color}`}>{cat.score}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className={`h-full rounded-full ${cat.bar} transition-all duration-700`} style={{ width: `${cat.score}%` }} />
                  </div>
                </div>
                <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${expanded === cat.label ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {expanded === cat.label && cat.actions.length > 0 && (
                <div className="px-md pb-sm pt-xs border-t border-outline-variant/20 flex flex-col gap-xs">
                  <p className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">ACTION ITEMS</p>
                  {cat.actions.map(a => (
                    <div key={a} className="flex flex-col gap-xs">
                      <div className="flex items-center gap-sm">
                        <span className="material-symbols-outlined text-[14px] text-primary">arrow_right</span>
                        <span className="text-body-sm text-on-surface">{a}</span>
                        <button
                          onClick={() => { setAssigning(assigning === a ? null : a); setAssignEmployeeId(''); }}
                          className="ml-auto text-[10px] text-primary font-label-caps font-bold hover:underline"
                        >
                          {assigning === a ? 'Cancel' : 'Assign'}
                        </button>
                      </div>
                      {assigning === a && (
                        <div className="ml-lg flex items-center gap-xs flex-wrap">
                          <select
                            value={assignEmployeeId}
                            onChange={e => setAssignEmployeeId(e.target.value)}
                            className="text-[11px] rounded-lg border border-outline-variant/50 bg-surface-container-low px-2 py-1 text-on-surface"
                          >
                            <option value="">Select team member…</option>
                            {employees.map((emp: any) => (
                              <option key={emp.id} value={emp.id}>{emp.firstName ?? emp.name} {emp.lastName ?? ''}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssign(a)}
                            disabled={!assignEmployeeId}
                            className="text-[10px] font-label-caps font-bold bg-primary text-on-primary px-2.5 py-1 rounded-full disabled:opacity-40"
                          >
                            Confirm assignment
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {expanded === cat.label && cat.actions.length === 0 && (
                <div className="px-md pb-sm pt-xs border-t border-outline-variant/20 flex items-center gap-xs text-tertiary">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span className="text-body-sm">No open gaps — all requirements met.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
