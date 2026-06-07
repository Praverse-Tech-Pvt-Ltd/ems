'use client';

import { useState, useEffect } from 'react';
import { clientsService } from '@/lib/api/clients';
import { useAuthStore } from '@/store/auth.store';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  ONBOARDING: 'bg-primary/10 text-primary border-primary/20',
  AT_RISK: 'bg-error/10 text-error border-error/20',
  RENEWAL: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
  INACTIVE: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
};
const CRITICALITY_COLOR: Record<string, string> = {
  LOW: 'text-tertiary',
  MEDIUM: 'text-primary',
  HIGH: 'text-error',
  CRITICAL: 'text-error',
};

const TIMELINE_ICON: Record<string, string> = {
  VISIT: 'directions_walk',
  AUDIT_PREP: 'fact_check',
  DOCUMENT_REVIEW: 'description',
  CLIENT_CALL: 'call',
  INTERNAL_MEETING: 'groups',
  EMPLOYEE_UPDATE: 'person',
  MEETING_NOTE: 'edit_note',
  PENDING_TASK: 'pending_actions',
  COMPLETED_TASK: 'task_alt',
  AI_SUMMARY: 'auto_awesome',
  NEXT_ACTION: 'arrow_forward',
  STATUS_CHANGE: 'sync_alt',
  ALERT: 'warning',
};

function HealthRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#4CAF50' : score >= 60 ? '#2196F3' : '#F44336';
  return (
    <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" stroke="currentColor" className="text-surface-container-highest" />
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" stroke={color}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x="28" y="28" textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" style={{ transform: 'rotate(90deg)', transformOrigin: '28px 28px', fontSize: '11px', fontWeight: 700, fill: 'currentColor' }}>
        {score}
      </text>
    </svg>
  );
}

export default function ClientCompaniesOverviewPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [detailCompany, setDetailCompany] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = async () => {
    try {
      const data = await clientsService.list().catch(() => []);
      setCompanies(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.sector?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pipeline = ['ONBOARDING', 'ACTIVE', 'AT_RISK', 'RENEWAL'].map(s => ({
    stage: s,
    count: companies.filter(c => c.status === s).length,
  }));

  const openDetails = async (company: any) => {
    setDetailCompany(company);
    setTimeline([]);
    setTimelineLoading(true);
    try {
      const data = await clientsService.timeline(company.id, 30).catch(() => []);
      setTimeline(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleAiSummary = async (id: string) => {
    setGeneratingAI(id);
    try {
      await clientsService.aiSummary(id);
      await load();
    } catch { /* ignore */ } finally {
      setGeneratingAI(null);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">domain</span>
          CLIENTS
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Client Companies</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Client Companies</h2>
            <p className="text-on-surface-variant mt-xs">Portfolio overview, health scores, and relationship status.</p>
          </div>
          {isAdmin && (
            <button className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 shrink-0">
              <span className="material-symbols-outlined text-[16px]">add</span>Add Client
            </button>
          )}
        </div>
      </div>

      {/* Pipeline funnel */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {pipeline.map(p => (
            <button key={p.stage} onClick={() => setStatusFilter(p.stage === statusFilter ? '' : p.stage)}
              className={`glass-card rounded-2xl p-md border text-left transition-all hover:-translate-y-0.5 ${statusFilter === p.stage ? 'border-primary bg-primary/5' : 'border-outline-variant/30'}`}>
              <p className="font-black text-3xl text-on-surface">{p.count}</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">{p.stage}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-sm flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..."
            className="w-full pl-9 pr-sm py-2.5 border border-outline-variant/50 rounded-xl text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
        </div>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="text-[11px] text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary/5">
            Clear: {statusFilter}
          </button>
        )}
      </div>

      {/* Company cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 rounded-2xl bg-surface-container-high animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          {search || statusFilter ? 'No companies match your filters.' : 'No client companies found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
          {filtered.map(company => (
            <div key={company.id} className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all">
              <div className="p-md flex flex-col gap-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                      {company.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface text-sm leading-tight">{company.name}</p>
                      <p className="text-[10px] text-on-surface-variant">{company.sector ?? 'Pharma'}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[company.status] ?? 'bg-surface-container-high text-on-surface-variant border-outline-variant/30'}`}>
                    {company.status}
                  </span>
                </div>

                <div className="flex items-center gap-md">
                  <HealthRing score={company.healthScore ?? 75} />
                  <div className="flex-1 flex flex-col gap-xs">
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Health Score</span>
                      <span className={`font-bold ${CRITICALITY_COLOR[company.criticality] ?? 'text-on-surface'}`}>{company.healthScore ?? 75}/100</span>
                    </div>
                    {company.criticality && (
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">Priority</span>
                        <span className={`font-bold ${CRITICALITY_COLOR[company.criticality]}`}>{company.criticality}</span>
                      </div>
                    )}
                    {company.lastVisitDate && (
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">Last Visit</span>
                        <span className="text-on-surface">{new Date(company.lastVisitDate).toLocaleDateString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {company.aiSummary && (
                  <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2 bg-surface-container-low rounded-lg px-sm py-xs">
                    {company.aiSummary}
                  </p>
                )}

                <div className="flex gap-xs border-t border-outline-variant/20 pt-sm">
                  <button onClick={() => openDetails(company)}
                    className="flex-1 text-[10px] text-primary border border-primary/20 px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                    View Details
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleAiSummary(company.id)} disabled={generatingAI === company.id}
                      className="flex-1 text-[10px] text-tertiary border border-tertiary/20 px-2 py-1.5 rounded-lg hover:bg-tertiary/5 transition-colors disabled:opacity-50">
                      {generatingAI === company.id ? 'Generating...' : 'AI Summary'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company analytics drawer — timestamped timeline of visits, gaps, action plans */}
      {detailCompany && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm" onClick={() => setDetailCompany(null)} />
          <div className="relative w-full max-w-lg h-full bg-surface-container-lowest border-l border-outline-variant/30 overflow-y-auto p-lg flex flex-col gap-lg">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
                  {detailCompany.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-on-surface text-lg leading-tight">{detailCompany.name}</h3>
                  <p className="text-[11px] text-on-surface-variant">{detailCompany.industry ?? 'Pharma'} · {detailCompany.criticality} criticality</p>
                </div>
              </div>
              <button onClick={() => setDetailCompany(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div className="glass-card rounded-xl p-sm border border-outline-variant/30">
                <p className="text-[10px] text-on-surface-variant tracking-widest font-label-caps">RISK SCORE</p>
                <p className="font-black text-xl text-on-surface mt-1">{detailCompany.riskScore ?? '—'}</p>
              </div>
              <div className="glass-card rounded-xl p-sm border border-outline-variant/30">
                <p className="text-[10px] text-on-surface-variant tracking-widest font-label-caps">LAST VISIT</p>
                <p className="font-semibold text-sm text-on-surface mt-1">
                  {detailCompany.lastVisitDate ? new Date(detailCompany.lastVisitDate).toLocaleDateString('en-IN') : 'No visits logged'}
                </p>
              </div>
            </div>

            {detailCompany.currentStage && (
              <div className="glass-card rounded-xl p-sm border border-outline-variant/30">
                <p className="text-[10px] text-on-surface-variant tracking-widest font-label-caps mb-1">CURRENT STAGE</p>
                <p className="text-body-sm text-on-surface">{detailCompany.currentStage}</p>
              </div>
            )}

            {detailCompany.notes && (
              <div className="glass-card rounded-xl p-sm border border-outline-variant/30">
                <p className="text-[10px] text-on-surface-variant tracking-widest font-label-caps mb-1">NOTES</p>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{detailCompany.notes}</p>
              </div>
            )}

            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">
                TIMESTAMPED ACTIVITY — VISITS, GAPS &amp; ACTION PLANS
              </p>
              {timelineLoading ? (
                <div className="flex flex-col gap-sm">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-surface-container-high animate-pulse" />)}
                </div>
              ) : timeline.length === 0 ? (
                <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30 text-body-sm">
                  No timeline activity recorded for this company yet.
                </div>
              ) : (
                <div className="relative flex flex-col gap-sm">
                  <div className="absolute left-[13px] top-2 bottom-2 w-px bg-outline-variant/30" />
                  {timeline.map((entry: any, i: number) => (
                    <div key={entry.id ?? i} className="relative pl-lg">
                      <div className="absolute left-0 top-1 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-[14px]">{TIMELINE_ICON[entry.entryType] ?? 'circle'}</span>
                      </div>
                      <div className="glass-card rounded-xl p-sm border border-outline-variant/30">
                        <div className="flex items-start justify-between gap-sm">
                          <p className="font-semibold text-on-surface text-sm leading-snug">{entry.title}</p>
                          <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30 shrink-0">
                            {entry.entryType?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">{entry.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-outline-variant/20">
                          <span className="text-[10px] text-on-surface-variant">
                            {entry.entryDate ? new Date(entry.entryDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          {entry.employee && (
                            <span className="text-[10px] text-on-surface-variant">{entry.employee.firstName} {entry.employee.lastName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
