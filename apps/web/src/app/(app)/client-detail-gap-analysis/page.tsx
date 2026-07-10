'use client';

import { useEffect, useMemo, useState } from 'react';
import { clientsService, followUpService } from '@/lib/api/clients';
import { employeesService } from '@/lib/api/employees';
import { useQueryClient } from '@tanstack/react-query';

type GapCategory = {
  label: string;
  score: number;
  gaps: string[];
  icon: string;
  color: string;
  bar: string;
  actions: string[];
};

const daysSince = (value?: string | null) => {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
};

const categoryStyle = (score: number) =>
  score >= 80
    ? { color: 'text-tertiary', bar: 'bg-tertiary' }
    : score >= 60
      ? { color: 'text-primary', bar: 'bg-primary' }
      : { color: 'text-error', bar: 'bg-error' };

function buildCategories(company: any, followUps: any[]): GapCategory[] {
  const visitDays = daysSince(company?.lastVisitDate);
  const commDays = daysSince(company?.lastCommunicationDate);
  const openFollowUps = followUps.filter(t => !company?.id || t.companyId === company.id || t.company?.id === company.id);
  const alertCount = company?.alerts?.length ?? 0;
  const currentStage = String(company?.currentStage ?? company?.notes ?? '').trim();
  const riskScore = Number(company?.riskScore ?? 0);

  const raw: Array<Omit<GapCategory, 'color' | 'bar'>> = [
    {
      label: 'Client Visits',
      score: visitDays === null ? 45 : visitDays > 45 ? 50 : visitDays > 30 ? 65 : 90,
      gaps: visitDays === null ? ['No visit date recorded'] : visitDays > 30 ? [`Last visit was ${visitDays} days ago`] : [],
      icon: 'directions_car',
      actions: visitDays === null || visitDays > 30 ? ['Schedule client visit and capture outcome'] : [],
    },
    {
      label: 'Communication Log',
      score: commDays === null ? 50 : commDays > 30 ? 55 : commDays > 15 ? 72 : 92,
      gaps: commDays === null ? ['No communication date recorded'] : commDays > 15 ? [`No communication for ${commDays} days`] : [],
      icon: 'forum',
      actions: commDays === null || commDays > 15 ? ['Log latest client call or follow-up'] : [],
    },
    {
      label: 'Follow-up Tasks',
      score: openFollowUps.length >= 5 ? 50 : openFollowUps.length >= 3 ? 68 : openFollowUps.length >= 1 ? 82 : 95,
      gaps: openFollowUps.map(t => t.reason).filter(Boolean).slice(0, 5),
      icon: 'task_alt',
      actions: openFollowUps.length ? openFollowUps.map(t => t.reason).filter(Boolean).slice(0, 3) : [],
    },
    {
      label: 'Risk & Alerts',
      score: Math.max(35, 100 - riskScore - alertCount * 10),
      gaps: [
        ...(riskScore >= 60 ? [`Risk score is ${riskScore}`] : []),
        ...(company?.alerts ?? []).map((a: any) => a.message ?? a.alertType).filter(Boolean),
      ].slice(0, 5),
      icon: 'warning',
      actions: alertCount || riskScore >= 60 ? ['Review risk reason and close stale alerts after action'] : [],
    },
    {
      label: 'Current Stage',
      score: currentStage ? 90 : 55,
      gaps: currentStage ? [] : ['Current project stage is not updated'],
      icon: 'timeline',
      actions: currentStage ? [] : ['Update current stage from latest team/client input'],
    },
  ];

  return raw.map(cat => ({ ...cat, ...categoryStyle(cat.score) }));
}

export default function ClientDetailGapAnalysisPage() {
  const queryClient = useQueryClient();
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignNote, setAssignNote] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const load = async () => {
    const [c, e, f] = await Promise.all([
      queryClient.fetchQuery({ queryKey: ['gap-companies'], queryFn: () => clientsService.list() }).catch(() => []),
      queryClient.fetchQuery({ queryKey: ['gap-employees'], queryFn: () => employeesService.list() }).catch(() => []),
      queryClient.fetchQuery({ queryKey: ['gap-followups'], queryFn: () => followUpService.list() }).catch(() => []),
    ]);
    const companyList = Array.isArray(c) ? c : c?.data ?? [];
    setCompanies(companyList);
    setEmployees(Array.isArray(e) ? e : e?.data ?? []);
    setFollowUps(Array.isArray(f) ? f : f?.data ?? []);
    setSelected(prev => prev || companyList[0]?.id || '');
  };

  useEffect(() => { load(); }, []);

  const selectedCompany = companies.find((c: any) => c.id === selected) ?? companies[0];
  const categories = useMemo(() => selectedCompany ? buildCategories(selectedCompany, followUps) : [], [selectedCompany, followUps]);
  const overallGapScore = categories.length ? Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length) : 0;
  const totalGaps = categories.reduce((s, c) => s + c.gaps.length, 0);
  const highestRisk = [...categories].sort((a, b) => a.score - b.score)[0];

  async function handleAssign(actionLabel: string) {
    if (!assignEmployeeId || !selectedCompany) return;
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await followUpService.create({
        companyId: selectedCompany.id,
        assignedTo: assignEmployeeId,
        dueDate,
        reason: actionLabel,
      });
      const employee = employees.find((e: any) => e.id === assignEmployeeId);
      setAssignNote(`Assigned "${actionLabel}" to ${employee?.firstName ?? 'team member'} for ${selectedCompany.name}.`);
      await load();
    } catch {
      setAssignNote('Could not create the assignment. Please try again.');
    } finally {
      setAssigning(null);
      setAssignEmployeeId('');
    }
  }

  async function generateActionPlan() {
    if (!selectedCompany) return;
    setGeneratingPlan(true);
    try {
      const res = await clientsService.aiSummary(selectedCompany.id);
      setActionPlan(res?.nextAction ?? res?.summary ?? 'AI action plan generated, but no recommendation was returned.');
      await load();
    } catch {
      const fallback = categories.flatMap(c => c.actions).slice(0, 4).join(' | ');
      setActionPlan(fallback || 'No open gaps found for this company.');
    } finally {
      setGeneratingPlan(false);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">rule_settings</span>
          CLIENT INTEL
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Gap Analysis</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Gap Analysis</h2>
            <p className="text-on-surface-variant mt-xs">Live gap scoring from company activity, follow-ups, alerts, visits, and AI summaries.</p>
          </div>
          <select value={selectedCompany?.id ?? ''} onChange={e => setSelected(e.target.value)} className="min-h-11 w-full sm:w-auto rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface">
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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

      {actionPlan && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-md py-sm flex items-start gap-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
          <span className="flex-1">{actionPlan}</span>
          <button onClick={() => setActionPlan(null)} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {!selectedCompany ? (
        <div className="glass-card rounded-2xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          No companies found. Add company data first to generate live gap analysis.
        </div>
      ) : (
        <>
          <div className={`rounded-2xl p-lg flex flex-col sm:flex-row items-center sm:items-center gap-lg border ${overallGapScore >= 80 ? 'bg-tertiary/5 border-tertiary/20' : overallGapScore >= 60 ? 'bg-primary/5 border-primary/20' : 'bg-error/5 border-error/20'}`}>
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
            <div className="flex-1 text-center sm:text-left">
              <p className="font-title-lg text-on-surface font-bold">{selectedCompany.name} Health Score</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">
                {totalGaps} live gap signals across {categories.filter(c => c.gaps.length > 0).length} categories.
                {highestRisk ? ` Highest risk: ${highestRisk.label}.` : ''}
              </p>
              <div className="flex gap-sm mt-sm flex-wrap justify-center sm:justify-start">
                <button onClick={generateActionPlan} disabled={generatingPlan} className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-3 py-1.5 rounded-full text-[11px] hover:opacity-90 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>{generatingPlan ? 'Generating...' : 'AI Action Plan'}
                </button>
                <button onClick={load} className="flex items-center gap-xs text-label-caps font-label-caps border border-outline-variant px-3 py-1.5 rounded-full text-[11px] text-on-surface-variant hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-[14px]">refresh</span>Refresh Data
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">CATEGORY GAPS</p>
            <div className="flex flex-col gap-sm">
              {categories.map(cat => (
                <div key={cat.label} className="glass-card rounded-xl border border-outline-variant/30 overflow-hidden">
                  <button onClick={() => setExpanded(expanded === cat.label ? null : cat.label)} className="w-full p-sm flex items-center gap-md hover:bg-surface-container-low transition-colors">
                    <span className={`material-symbols-outlined ${cat.color}`}>{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-on-surface text-sm">{cat.label}</p>
                        <div className="flex items-center gap-sm">
                          {cat.gaps.length > 0 && <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full border border-error/20">{cat.gaps.length} gaps</span>}
                          <span className={`font-bold text-sm ${cat.color}`}>{cat.score}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                        <div className={`h-full rounded-full ${cat.bar} transition-all duration-700`} style={{ width: `${cat.score}%` }} />
                      </div>
                    </div>
                    <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${expanded === cat.label ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {expanded === cat.label && (
                    <div className="px-md pb-sm pt-xs border-t border-outline-variant/20 flex flex-col gap-xs">
                      {cat.gaps.length === 0 ? (
                        <div className="flex items-center gap-xs text-tertiary">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span className="text-body-sm">No live gaps in this category.</span>
                        </div>
                      ) : (
                        <>
                          <p className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">LIVE SIGNALS</p>
                          {cat.gaps.map(gap => <p key={gap} className="text-body-sm text-on-surface">- {gap}</p>)}
                          {cat.actions.map(a => (
                            <div key={a} className="flex items-center gap-sm mt-xs">
                              <span className="material-symbols-outlined text-[14px] text-primary">arrow_right</span>
                              <span className="text-body-sm text-on-surface">{a}</span>
                              <button onClick={() => { setAssigning(assigning === a ? null : a); setAssignEmployeeId(''); }} className="ml-auto text-[10px] text-primary font-label-caps font-bold hover:underline">
                                {assigning === a ? 'Cancel' : 'Assign'}
                              </button>
                            </div>
                          ))}
                          {cat.actions.map(a => assigning === a && (
                            <div key={`${a}-assign`} className="ml-lg flex items-center gap-xs flex-wrap">
                              <select value={assignEmployeeId} onChange={e => setAssignEmployeeId(e.target.value)} className="text-[11px] rounded-lg border border-outline-variant/50 bg-surface-container-low px-2 py-1 text-on-surface">
                                <option value="">Select team member</option>
                                {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName ?? ''}</option>)}
                              </select>
                              <button onClick={() => handleAssign(a)} disabled={!assignEmployeeId} className="text-[10px] font-label-caps font-bold bg-primary text-on-primary px-2.5 py-1 rounded-full disabled:opacity-40">
                                Confirm assignment
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
