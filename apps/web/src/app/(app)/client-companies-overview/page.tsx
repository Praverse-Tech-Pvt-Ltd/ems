'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clientsService } from '@/lib/api/clients';
import { useAuthStore } from '@/store/auth.store';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  DELAYED: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  AT_RISK: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  LOST: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  DORMANT: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const CRITICALITY_COLOR: Record<string, string> = {
  LOW: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  HIGH: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  CRITICAL: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
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
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="text-slate-100 dark:text-slate-800" stroke="currentColor" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className={color} stroke="currentColor"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono text-slate-800 dark:text-white">
        {score}
      </div>
    </div>
  );
}

export default function ClientCompaniesOverviewPage() {
  const queryClient = useQueryClient();
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [addForm, setAddForm] = useState({
    name: '', industry: 'Pharma', businessStatus: 'ACTIVE', criticality: 'MEDIUM',
    contactEmail: '', contactPhone: '', address: '', notes: '',
  });

  const load = async () => {
    try {
      const data = await queryClient.fetchQuery({ queryKey: ['overview-companies'], queryFn: () => clientsService.list() }).catch(() => []);
      setCompanies(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.industry?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.businessStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const pipeline = ['ACTIVE', 'DELAYED', 'AT_RISK', 'DORMANT'].map(s => ({
    stage: s,
    count: companies.filter(c => c.businessStatus === s).length,
  }));

  const openDetails = async (company: any) => {
    setDetailCompany(company);
    setTimeline([]);
    setTimelineLoading(true);
    try {
      const data = await queryClient.fetchQuery({ queryKey: ['overview-timeline', company.id], queryFn: () => clientsService.timeline(company.id, 30) }).catch(() => []);
      setTimeline(Array.isArray(data) ? data : data?.data ?? []);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setAddMsg('Company name is required');
      return;
    }
    setAdding(true);
    setAddMsg('');
    try {
      await clientsService.create({
        name: addForm.name,
        industry: addForm.industry || undefined,
        businessStatus: addForm.businessStatus,
        criticality: addForm.criticality,
        contactEmail: addForm.contactEmail || undefined,
        contactPhone: addForm.contactPhone || undefined,
        address: addForm.address || undefined,
        notes: addForm.notes || undefined,
      });
      setShowAddForm(false);
      setAddForm({ name: '', industry: 'Pharma', businessStatus: 'ACTIVE', criticality: 'MEDIUM', contactEmail: '', contactPhone: '', address: '', notes: '' });
      await load();
    } catch (e: any) {
      setAddMsg(e?.response?.data?.message ?? 'Failed to create company');
    } finally {
      setAdding(false);
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
    <div className="flex flex-col gap-lg animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-sm">
        <div className="font-label-caps text-label-caps text-indigo-500 dark:text-indigo-400 tracking-widest flex items-center gap-xs mb-xs font-bold">
          <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
          CLIENTS
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-slate-800 dark:text-white hidden md:block">Client Portfolios</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-slate-800 dark:text-white md:hidden">Client Portfolios</h2>
            <p className="text-slate-400 dark:text-slate-500 mt-xs text-sm">Portfolio overview, health scores, and critical relationships tracking.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowAddForm(true); setAddMsg(''); }}
              className="flex items-center gap-xs text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full shadow-lg shadow-indigo-600/15 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>Add Client Portfolio
            </button>
          )}
        </div>
      </div>

      {/* Pipeline funnel */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {pipeline.map(p => (
            <button 
              key={p.stage} 
              onClick={() => setStatusFilter(p.stage === statusFilter ? '' : p.stage)}
              className={`bg-white dark:bg-[#111c2e] rounded-3xl p-5 border text-left transition-all hover:shadow-md ${statusFilter === p.stage ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <p className="font-extrabold text-2xl text-slate-800 dark:text-white font-mono">{p.count}</p>
              <p className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-1">{p.stage.replace(/_/g, ' ')}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search & filters */}
      <div className="flex gap-sm flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search companies by name or sector..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-full text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        {statusFilter && (
          <button 
            onClick={() => setStatusFilter('')} 
            className="text-[10px] font-bold text-indigo-500 border border-indigo-500/20 bg-indigo-500/5 px-4.5 py-2 rounded-full hover:bg-indigo-500/10 transition-colors"
          >
            Clear Filter: {statusFilter.replace(/_/g, ' ')}
          </button>
        )}
      </div>

      {/* Company cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-52 rounded-3xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-lg text-center text-slate-400 dark:text-slate-500 text-sm">
          {search || statusFilter ? 'No companies match your filters.' : 'No client companies found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
          {filtered.map(company => (
            <div 
              key={company.id} 
              className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="p-5 flex flex-col justify-between min-h-[220px]">
                <div>
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-extrabold text-sm shrink-0 border border-indigo-500/20">
                        {company.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight truncate">{company.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{company.industry ?? 'Pharma'}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[company.businessStatus] ?? 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                      {company.businessStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-4 py-3 border-t border-slate-100 dark:border-slate-800/60">
                    <HealthRing score={100 - (company.riskScore ?? 0)} />
                    <div className="flex-grow flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Operational Health</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{100 - (company.riskScore ?? 0)}/100</span>
                      </div>
                      {company.criticality && (
                        <div className="flex justify-between">
                          <span>Risk Profile</span>
                          <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${CRITICALITY_COLOR[company.criticality]}`}>
                            {company.criticality}
                          </span>
                        </div>
                      )}
                      {company.lastVisitDate && (
                        <div className="flex justify-between">
                          <span>Last Sync Audit</span>
                          <span className="text-slate-700 dark:text-slate-300 font-mono">
                            {new Date(company.lastVisitDate).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {company.aiSummaries?.[0]?.content && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl px-3 py-2 italic mt-2 border border-slate-100 dark:border-slate-800">
                      "{company.aiSummaries[0].content}"
                    </p>
                  )}
                </div>

                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-4">
                  <button 
                    onClick={() => openDetails(company)}
                    className="flex-1 text-[10px] font-bold text-indigo-500 border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-2 rounded-xl hover:bg-indigo-500/10 transition-colors"
                  >
                    View Timeline
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleAiSummary(company.id)} 
                      disabled={generatingAI === company.id}
                      className="flex-1 text-[10px] font-bold text-purple-500 border border-purple-500/20 bg-purple-500/5 px-2.5 py-2 rounded-xl hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                    >
                      {generatingAI === company.id ? 'Generating...' : 'AI Summary'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Portfolio Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 relative overflow-hidden transition-all shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <span className="font-extrabold text-base text-slate-800 dark:text-white">Add Client Portfolio</span>
              <button
                onClick={() => setShowAddForm(false)}
                className="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                close
              </button>
            </div>

            {addMsg && (
              <div className="mb-4 text-xs font-bold px-4 py-2.5 rounded-xl border bg-rose-500/10 text-rose-500 border-rose-500/20">
                {addMsg}
              </div>
            )}

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</label>
                <input
                  required
                  value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Anphar Labs"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                  <input
                    value={addForm.industry}
                    onChange={e => setAddForm(p => ({ ...p, industry: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Business Status</label>
                  <select
                    value={addForm.businessStatus}
                    onChange={e => setAddForm(p => ({ ...p, businessStatus: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {['ACTIVE', 'DELAYED', 'AT_RISK', 'LOST', 'DORMANT'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Criticality</label>
                <select
                  value={addForm.criticality}
                  onChange={e => setAddForm(p => ({ ...p, criticality: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {['HIGH', 'MEDIUM', 'LOW'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={addForm.contactEmail}
                    onChange={e => setAddForm(p => ({ ...p, contactEmail: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Phone</label>
                  <input
                    value={addForm.contactPhone}
                    onChange={e => setAddForm(p => ({ ...p, contactPhone: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</label>
                <input
                  value={addForm.address}
                  onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={addForm.notes}
                  onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={adding}
                className="w-full py-2.5 rounded-2xl font-bold text-sm tracking-tight bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/15 transition-all disabled:opacity-50"
              >
                {adding ? 'Creating...' : 'Create Client Portfolio'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over details timeline drawer */}
      {detailCompany && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setDetailCompany(null)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-[#111c2e] border-l border-slate-200 dark:border-slate-800 overflow-y-auto p-6 flex flex-col gap-6 shadow-2xl animate-slide-in">
            <div className="flex items-start justify-between gap-sm border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-extrabold shrink-0 border border-indigo-500/20">
                  {detailCompany.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">{detailCompany.name}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{detailCompany.industry ?? 'Pharma'} · {detailCompany.criticality} criticality</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailCompany(null)} 
                className="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Risk Score</p>
                <p className="font-extrabold text-lg text-slate-800 dark:text-white mt-1 font-mono">{detailCompany.riskScore ?? '—'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Last Visit Logged</p>
                <p className="font-bold text-xs text-slate-800 dark:text-white mt-2 font-mono">
                  {detailCompany.lastVisitDate ? new Date(detailCompany.lastVisitDate).toLocaleDateString('en-IN') : 'No logs'}
                </p>
              </div>
            </div>

            {detailCompany.currentStage && (
              <div className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Current Operations Stage</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{detailCompany.currentStage}</p>
              </div>
            )}

            {detailCompany.notes && (
              <div className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Strategic Account Notes</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{detailCompany.notes}</p>
              </div>
            )}

            <div>
              <p className="font-label-caps text-label-caps text-slate-400 dark:text-slate-500 tracking-widest mb-sm font-bold">
                TELEMETRY ACTIVITY FEED
              </p>
              
              {timelineLoading ? (
                <div className="flex flex-col gap-sm">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : timeline.length === 0 ? (
                <div className="bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                  No activity timelines recorded for this client.
                </div>
              ) : (
                <div className="relative flex flex-col gap-sm">
                  <div className="absolute left-[13px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
                  
                  {timeline.map((entry: any, i: number) => (
                    <div key={entry.id ?? i} className="relative pl-lg">
                      <div className="absolute left-0 top-1 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-indigo-500 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <span className="material-symbols-outlined text-[13px]">{TIMELINE_ICON[entry.entryType] ?? 'circle'}</span>
                      </div>
                      
                      <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80">
                        <div className="flex items-start justify-between gap-sm">
                          <p className="font-bold text-xs text-slate-800 dark:text-white leading-snug">{entry.title}</p>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider">
                            {entry.entryType?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        
                        {entry.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed mt-1.5">{entry.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[9px] text-slate-400 font-semibold font-mono">
                          <span>
                            {entry.entryDate ? new Date(entry.entryDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          {entry.employee && (
                            <span className="text-slate-500 dark:text-slate-400">{entry.employee.firstName} {entry.employee.lastName}</span>
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
