'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Calendar, User, AlertTriangle, Clock, ArrowLeft,
  BrainCircuit, FileText, Eye, Activity, MapPin, Phone, Mail,
  Plus, ChevronDown, CheckCircle, Upload, Download, MessageSquare,
  ClipboardCheck, X,
} from 'lucide-react';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const TIMELINE_ICONS: Record<string, any> = {
  VISIT: MapPin, AUDIT_PREP: AlertTriangle, DOCUMENT_REVIEW: FileText,
  CLIENT_CALL: Phone, INTERNAL_MEETING: User, EMPLOYEE_UPDATE: Activity,
  MEETING_NOTE: FileText, COMPLETED_TASK: CheckCircle, AI_SUMMARY: BrainCircuit,
  STATUS_CHANGE: Eye, ALERT: AlertTriangle,
};

const TIMELINE_COLORS: Record<string, string> = {
  VISIT: 'bg-blue-100 border-blue-300 text-blue-800',
  AUDIT_PREP: 'bg-red-100 border-red-300 text-red-800',
  EMPLOYEE_UPDATE: 'bg-green-100 border-green-300 text-green-800',
  AI_SUMMARY: 'bg-purple-100 border-purple-300 text-purple-800',
  STATUS_CHANGE: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  MEETING_NOTE: 'bg-orange-100 border-orange-300 text-orange-800',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300',
  AT_RISK: 'bg-red-100 text-red-800 border-red-300',
  DELAYED: 'bg-orange-100 text-orange-800 border-orange-300',
  DORMANT: 'bg-purple-100 text-purple-800 border-purple-300',
  LOST: 'bg-gray-100 text-gray-600 border-gray-300',
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'updates' | 'projects' | 'audit' | 'documents' | 'communications'>('overview');

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => apiClient.get(`/client-companies/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['company-timeline', id],
    queryFn: () => apiClient.get(`/client-companies/${id}/timeline`).then(r => r.data),
    enabled: !!id && activeTab === 'timeline',
  });

  const { data: aiSummary, mutate: generateSummary, isPending: generating } = useMutation({
    mutationFn: () => apiClient.post(`/client-companies/${id}/ai-summary`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-brutal-surface animate-pulse brutal-border mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-brutal-surface animate-pulse brutal-border" />)}
        </div>
      </div>
    );
  }

  if (!company) return <div className="p-6 font-display font-bold text-brutal-red">Company not found</div>;

  const now = new Date();
  const daysSinceVisit = company.lastVisitDate ? differenceInDays(now, new Date(company.lastVisitDate)) : null;
  const daysSinceComm = company.lastCommunicationDate ? differenceInDays(now, new Date(company.lastCommunicationDate)) : null;
  const daysToAudit = company.nextAuditDate ? differenceInDays(new Date(company.nextAuditDate), now) : null;
  const latestSummary = company.aiSummaries?.[0];

  return (
    <div className="p-4 lg:p-6">
      {/* Back + Header */}
      <div className="mb-4">
        <Link href="/companies" className="flex items-center gap-1 text-sm font-display font-bold text-brutal-ink/60 hover:text-brutal-ink mb-3">
          <ArrowLeft size={14} /> Companies
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-brutal-ink text-brutal-yellow grid place-items-center brutal-border">
                <Building2 size={18} />
              </div>
              <h1 className="font-display font-bold text-2xl">{company.name}</h1>
              {company.shortName && <span className="text-brutal-ink/40 font-display text-sm">({company.shortName})</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-2 py-0.5 text-[11px] font-display font-bold border ${STATUS_COLORS[company.businessStatus] ?? ''}`}>
                {company.businessStatus}
              </span>
              <span className={`px-2 py-0.5 text-[11px] font-display font-bold border ${
                company.criticality === 'HIGH' ? 'bg-yellow-100 border-yellow-400 text-yellow-800' :
                company.criticality === 'LOW' ? 'bg-green-50 border-green-300 text-green-700' :
                'bg-brutal-surface border-brutal-ink/30 text-brutal-ink'
              }`}>{company.criticality} PRIORITY</span>
              <span className={`px-2 py-0.5 text-[11px] font-display font-bold border ${
                company.riskScore >= 60 ? 'bg-red-100 border-red-300 text-red-800' :
                company.riskScore >= 30 ? 'bg-orange-50 border-orange-300 text-orange-700' :
                'bg-green-50 border-green-300 text-green-700'
              }`}>RISK {company.riskScore}/100</span>
            </div>
          </div>
          <Button
            onClick={() => generateSummary()}
            disabled={generating}
            size="sm"
            className="flex items-center gap-2"
          >
            <BrainCircuit size={14} />
            {generating ? 'Generating…' : 'AI Summary'}
          </Button>
        </div>
      </div>

      {/* AI Summary banner */}
      {(aiSummary || latestSummary) && (
        <div className="mb-4 bg-purple-50 border-2 border-purple-300 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={14} className="text-purple-700" />
            <span className="font-display font-bold text-[11px] tracking-widest uppercase text-purple-700">AI Overview</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed">{aiSummary?.summary ?? latestSummary?.content}</p>
          {(aiSummary?.nextAction ?? latestSummary?.metadata?.nextAction) && (
            <div className="mt-3 bg-white border border-purple-200 p-2 text-[12px] font-bold text-purple-800">
              → Next Action: {aiSummary?.nextAction ?? latestSummary?.metadata?.nextAction}
            </div>
          )}
        </div>
      )}

      {/* Alert strip */}
      {company.alerts?.length > 0 && (
        <div className="mb-4 space-y-1">
          {company.alerts.map((alert: any) => (
            <div key={alert.id} className={`flex items-center gap-2 p-2 text-sm border ${
              alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-300 text-red-800' :
              alert.severity === 'MODERATE' ? 'bg-orange-50 border-orange-300 text-orange-800' :
              'bg-yellow-50 border-yellow-300 text-yellow-800'
            }`}>
              <AlertTriangle size={13} />
              <span className="font-bold text-[10px]">[{alert.severity}]</span>
              <span className="text-[12px]">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Days Since Visit', value: daysSinceVisit !== null ? `${daysSinceVisit}d` : '—', urgent: daysSinceVisit !== null && daysSinceVisit >= 30 },
          { label: 'Days Since Comm', value: daysSinceComm !== null ? `${daysSinceComm}d` : '—', urgent: daysSinceComm !== null && daysSinceComm >= 15 },
          { label: 'Audit In', value: daysToAudit !== null && daysToAudit >= 0 ? `${daysToAudit}d` : '—', urgent: daysToAudit !== null && daysToAudit <= 30 },
          { label: 'Responsible', value: company.responsibleEmployee ? `${company.responsibleEmployee.firstName} ${company.responsibleEmployee.lastName}` : '—', urgent: false },
        ].map(k => (
          <div key={k.label} className={`brutal-border p-3 ${k.urgent ? 'bg-red-50 border-brutal-red' : 'bg-white'}`}>
            <div className={`font-display font-bold text-xl ${k.urgent ? 'text-brutal-red' : ''}`}>{k.value}</div>
            <div className="font-display text-[10px] tracking-widest uppercase text-brutal-ink/50">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-brutal-ink mb-4 overflow-x-auto">
        {(['overview', 'timeline', 'updates', 'projects', 'audit', 'documents', 'communications'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-display font-bold text-[11px] tracking-widest uppercase border-r-2 border-brutal-ink transition-colors whitespace-nowrap ${
              activeTab === tab ? 'bg-brutal-ink text-white' : 'bg-white hover:bg-brutal-surface'
            }`}
          >
            {tab === 'audit' ? '🔍 Audit' : tab === 'documents' ? '📁 Docs' : tab === 'communications' ? '💬 Comms' : tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="brutal-border p-4 bg-white">
            <h3 className="font-display font-bold text-[12px] tracking-widest uppercase mb-3 pb-2 border-b border-brutal-ink/10">Company Info</h3>
            <div className="space-y-2 text-sm">
              {company.currentStage && <InfoRow label="Current Stage" value={company.currentStage} />}
              {company.industry && <InfoRow label="Industry" value={company.industry} />}
              {company.contactEmail && <InfoRow label="Email" value={company.contactEmail} />}
              {company.contactPhone && <InfoRow label="Phone" value={company.contactPhone} />}
              {company.address && <InfoRow label="Address" value={company.address} />}
              {company.notes && <InfoRow label="Notes" value={company.notes} />}
            </div>
          </div>

          <div className="brutal-border p-4 bg-white">
            <h3 className="font-display font-bold text-[12px] tracking-widest uppercase mb-3 pb-2 border-b border-brutal-ink/10">Key Dates</h3>
            <div className="space-y-2 text-sm">
              <InfoRow label="Last Visit" value={company.lastVisitDate ? format(new Date(company.lastVisitDate), 'dd MMM yyyy') : 'Not recorded'} />
              <InfoRow label="Last Comm" value={company.lastCommunicationDate ? format(new Date(company.lastCommunicationDate), 'dd MMM yyyy') : 'Not recorded'} />
              <InfoRow label="Next Audit" value={company.nextAuditDate ? format(new Date(company.nextAuditDate), 'dd MMM yyyy') : 'Not scheduled'} />
            </div>
          </div>

          {company.contacts?.length > 0 && (
            <div className="brutal-border p-4 bg-white">
              <h3 className="font-display font-bold text-[12px] tracking-widest uppercase mb-3">Contacts</h3>
              {company.contacts.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 py-2 border-b border-brutal-ink/10 last:border-0">
                  <User size={12} className="mt-0.5 text-brutal-ink/40" />
                  <div>
                    <div className="font-bold text-[12px]">{c.name} {c.isPrimary && <span className="text-[9px] bg-brutal-yellow px-1">PRIMARY</span>}</div>
                    <div className="text-[11px] text-brutal-ink/60">{c.designation}</div>
                    {c.email && <div className="text-[11px] text-brutal-ink/60">{c.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {company.visits?.length > 0 && (
            <div className="brutal-border p-4 bg-white">
              <h3 className="font-display font-bold text-[12px] tracking-widest uppercase mb-3">Recent Visits</h3>
              {company.visits.slice(0, 5).map((v: any) => (
                <div key={v.id} className="py-2 border-b border-brutal-ink/10 last:border-0 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold">{format(new Date(v.visitDate), 'dd MMM yyyy')}</span>
                    <span className="text-brutal-ink/60 text-[11px]">{v.visitor.firstName} {v.visitor.lastName}</span>
                  </div>
                  {v.outcome && <div className="text-[11px] text-brutal-ink/70 mt-0.5">{v.outcome}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-brutal-ink/10" />
          <div className="space-y-3">
            {timeline.length === 0 && (
              <div className="pl-12 text-brutal-ink/40 font-display text-sm">No timeline entries yet</div>
            )}
            {timeline.map((entry: any) => {
              const Icon = TIMELINE_ICONS[entry.entryType] ?? Activity;
              const colorClass = TIMELINE_COLORS[entry.entryType] ?? 'bg-brutal-surface border-brutal-ink/20 text-brutal-ink';
              return (
                <div key={entry.id} className="flex gap-3 relative pl-2">
                  <div className={`w-8 h-8 flex-shrink-0 grid place-items-center border ${colorClass} z-10`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 brutal-border p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display font-bold text-[12px]">{entry.title}</div>
                        {entry.description && <div className="text-[11px] text-brutal-ink/60 mt-0.5">{entry.description}</div>}
                        {entry.employee && (
                          <div className="text-[10px] text-brutal-ink/40 mt-1">
                            {entry.employee.firstName} {entry.employee.lastName}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-brutal-ink/40 flex-shrink-0">
                        {format(new Date(entry.entryDate), 'dd MMM, HH:mm')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Updates Tab */}
      {activeTab === 'updates' && <WorkUpdatesTab companyId={id} />}

      {/* Audit Tab */}
      {activeTab === 'audit' && <AuditTab companyId={id} projects={company.projects ?? []} />}

      {/* Documents Tab */}
      {activeTab === 'documents' && <DocumentsTab companyId={id} />}

      {/* Communications Tab */}
      {activeTab === 'communications' && <CommunicationsTab companyId={id} />}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-3">
          {company.projects?.length === 0 && (
            <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No projects</div>
          )}
          {company.projects?.map((p: any) => (
            <div key={p.id} className="brutal-border p-4 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-bold">{p.name}</div>
                  {p.description && <div className="text-sm text-brutal-ink/60 mt-1">{p.description}</div>}
                  {p.auditDate && (
                    <div className="text-[11px] text-orange-600 mt-1 font-bold">
                      Audit: {format(new Date(p.auditDate), 'dd MMM yyyy')}
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-display font-bold px-2 py-0.5 border ${
                  p.status === 'ACTIVE' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-display font-bold text-[11px] text-brutal-ink/50 w-28 flex-shrink-0">{label}</span>
      <span className="text-[12px] text-brutal-ink">{value}</span>
    </div>
  );
}

function WorkUpdatesTab({ companyId }: { companyId: string }) {
  const { data } = useQuery({
    queryKey: ['work-updates', companyId],
    queryFn: () => apiClient.get('/work-updates', { params: { companyId } }).then(r => r.data),
  });
  const updates = data?.items ?? [];
  return (
    <div className="space-y-2">
      {updates.length === 0 && (
        <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No work updates for this company</div>
      )}
      {updates.map((u: any) => (
        <div key={u.id} className="brutal-border p-3 bg-white">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-display font-bold text-[11px]">{u.employee.firstName} {u.employee.lastName}</span>
            <span className="text-[10px] text-brutal-ink/40">{format(new Date(u.updateDate), 'dd MMM')}</span>
          </div>
          <p className="text-[12px] text-brutal-ink/80 mb-2">{u.rawText}</p>
          {u.taskCompleted && <div className="text-[11px] text-green-700">✓ {u.taskCompleted}</div>}
          {u.pendingTask && <div className="text-[11px] text-orange-600">⏳ {u.pendingTask}</div>}
          {u.nextAction && <div className="text-[11px] text-brutal-blue font-bold mt-1">→ {u.nextAction}</div>}
          {u.needsAdminReview && (
            <span className="text-[10px] bg-yellow-100 border border-yellow-300 text-yellow-800 px-1 font-bold">NEEDS REVIEW</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Audit Readiness Tab ───────────────────────────────────────────────────────
const AUDIT_TYPES = ['WHO', 'GMP', 'CDSCO', 'FDA'];
const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800 border-green-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  SUBMITTED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PENDING: 'bg-gray-100 text-gray-600 border-gray-300',
  NOT_APPLICABLE: 'bg-purple-50 text-purple-500 border-purple-200',
};
const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'NOT_APPLICABLE'];

function AuditTab({ companyId, projects }: { companyId: string; projects: any[] }) {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.id ?? '');
  const [showSeed, setShowSeed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-readiness', selectedProject],
    queryFn: () => apiClient.get(`/audit-readiness/${selectedProject}`).then(r => r.data),
    enabled: !!selectedProject,
  });

  const { mutate: updateItem } = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      apiClient.patch(`/audit-readiness/${selectedProject}/items/${itemId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-readiness', selectedProject] }),
  });

  const { mutate: seedChecklist, isPending: seeding } = useMutation({
    mutationFn: (auditType: string) =>
      apiClient.post(`/audit-readiness/${selectedProject}/seed`, { auditType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['audit-readiness', selectedProject] }); setShowSeed(false); },
  });

  const { mutate: getAIGaps, isPending: gettingGaps, data: gapsData } = useMutation({
    mutationFn: () => apiClient.post(`/audit-readiness/${selectedProject}/ai-gaps`).then(r => r.data),
  });

  if (projects.length === 0) {
    return (
      <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">
        No projects — add a project with an audit date first
      </div>
    );
  }

  const readiness = data?.readinessPercent ?? 0;
  const daysToAudit = data?.daysToAudit;

  return (
    <div className="space-y-4">
      {/* Project selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="brutal-border px-3 py-2 font-display text-sm outline-none bg-white"
        >
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}{p.auditDate ? ` — ${format(new Date(p.auditDate), 'dd MMM yyyy')}` : ''}</option>
          ))}
        </select>

        {/* Seed dropdown */}
        <div className="relative">
          <button onClick={() => setShowSeed(!showSeed)} className="brutal-border px-3 py-2 font-display font-bold text-[11px] uppercase bg-white hover:bg-brutal-yellow flex items-center gap-1">
            Seed Checklist <ChevronDown size={11} />
          </button>
          {showSeed && (
            <div className="absolute top-full left-0 mt-1 brutal-border bg-white z-10 w-32">
              {AUDIT_TYPES.map(t => (
                <button key={t} onClick={() => seedChecklist(t)} disabled={seeding}
                  className="block w-full text-left px-3 py-2 font-display font-bold text-[12px] hover:bg-brutal-yellow border-b border-brutal-ink/10 last:border-0">
                  {t} {seeding && '…'}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => getAIGaps()}
          disabled={gettingGaps}
          className="brutal-border px-3 py-2 font-display font-bold text-[11px] uppercase bg-white hover:bg-brutal-blue hover:text-white flex items-center gap-1"
        >
          <BrainCircuit size={12} /> {gettingGaps ? 'Analyzing…' : 'AI Gaps'}
        </button>

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/audit-readiness/${selectedProject}/export/pdf`}
          target="_blank"
          className="brutal-border px-3 py-2 font-display font-bold text-[11px] uppercase bg-white hover:bg-brutal-surface flex items-center gap-1"
        >
          <FileText size={12} /> Export PDF
        </a>
      </div>

      {/* Readiness bar */}
      {data && (
        <div className="brutal-border p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-[12px] tracking-widest uppercase">
              Audit Readiness
            </span>
            <div className="flex items-center gap-3">
              <span className={`font-display font-bold text-2xl ${readiness >= 80 ? 'text-green-600' : readiness >= 50 ? 'text-orange-500' : 'text-brutal-red'}`}>
                {readiness}%
              </span>
              {daysToAudit !== null && (
                <span className={`font-display font-bold text-[13px] px-2 py-0.5 border ${daysToAudit <= 14 ? 'bg-red-50 border-brutal-red text-brutal-red' : daysToAudit <= 30 ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-brutal-surface border-brutal-ink/30'}`}>
                  {daysToAudit <= 0 ? 'AUDIT TODAY/OVERDUE' : `${daysToAudit}d to audit`}
                </span>
              )}
            </div>
          </div>
          <div className="h-4 brutal-border bg-brutal-surface">
            <div
              className={`h-full transition-all ${readiness >= 80 ? 'bg-green-500' : readiness >= 50 ? 'bg-orange-400' : 'bg-brutal-red'}`}
              style={{ width: `${readiness}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-[11px] text-brutal-ink/60">
            <span>Total: {data.total}</span>
            <span>✓ {data.done} approved/N/A</span>
            <span>⏳ {data.total - data.done} pending</span>
          </div>
        </div>
      )}

      {/* AI Gaps */}
      {gapsData?.analysis && (
        <div className="bg-purple-50 border-2 border-purple-300 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={13} className="text-purple-700" />
            <span className="font-display font-bold text-[11px] uppercase tracking-widest text-purple-700">AI Gap Analysis</span>
          </div>
          <pre className="text-[12px] text-purple-900 whitespace-pre-wrap font-mono leading-relaxed">{gapsData.analysis}</pre>
        </div>
      )}

      {/* Checklist by category */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 brutal-border bg-brutal-surface animate-pulse" />)}</div>
      ) : data?.items?.length === 0 ? (
        <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">
          No checklist items — click "Seed Checklist" to add WHO/GMP/CDSCO/FDA items
        </div>
      ) : (
        Object.entries(data?.byCategory ?? {}).map(([category, items]: [string, any]) => (
          <div key={category}>
            <div className="font-display font-bold text-[10px] tracking-widest uppercase bg-brutal-ink text-white px-3 py-1.5 mb-1">
              {category}
            </div>
            <div className="space-y-0.5">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2 brutal-border px-3 py-2 bg-white hover:bg-brutal-surface">
                  <select
                    value={item.status}
                    onChange={e => updateItem({ itemId: item.id, status: e.target.value })}
                    className={`text-[10px] font-display font-bold px-2 py-0.5 border outline-none cursor-pointer ${STATUS_COLOR[item.status] ?? ''}`}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <span className="flex-1 text-[12px] font-display">{item.title}</span>
                  {item.responsible && (
                    <span className="text-[10px] text-brutal-ink/50">{item.responsible.firstName}</span>
                  )}
                  {item.dueDate && (
                    <span className={`text-[10px] font-bold ${differenceInDays(new Date(item.dueDate), new Date()) <= 3 ? 'text-brutal-red' : 'text-brutal-ink/40'}`}>
                      {format(new Date(item.dueDate), 'dd MMM')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────
const DOC_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600 border-gray-300',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  APPROVED: 'bg-green-100 text-green-800 border-green-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  EXPIRED: 'bg-purple-100 text-purple-800 border-purple-300',
};

function DocumentsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ docName: '', docType: '', notes: '', expiresAt: '' });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['company-docs', companyId],
    queryFn: () => apiClient.get(`/company-documents/${companyId}`).then(r => r.data),
  });

  const { mutate: createDoc } = useMutation({
    mutationFn: () => apiClient.post(`/company-documents/${companyId}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-docs', companyId] }); setShowForm(false); setForm({ docName: '', docType: '', notes: '', expiresAt: '' }); },
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/company-documents/${companyId}/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-docs', companyId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-display font-bold text-[11px] tracking-widest uppercase text-brutal-ink/60">
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={13} /> Add Document
        </Button>
      </div>

      {showForm && (
        <div className="brutal-border p-4 bg-brutal-surface space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Document Name *</label>
              <input value={form.docName} onChange={e => setForm(f => ({ ...f, docName: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Document Type *</label>
              <input value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))} placeholder="e.g. GMP Certificate, Drug License" className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Expiry Date</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.docName || !form.docType} onClick={() => createDoc()}>Save</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? <div className="h-20 brutal-border bg-brutal-surface animate-pulse" /> :
        docs.length === 0 ? <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No documents yet</div> :
        <div className="space-y-2">
          {docs.map((doc: any) => {
            const daysToExpiry = doc.expiresAt ? differenceInDays(new Date(doc.expiresAt), new Date()) : null;
            const expiryUrgent = daysToExpiry !== null && daysToExpiry <= 30;
            return (
              <div key={doc.id} className={`brutal-border p-3 bg-white ${expiryUrgent ? 'border-orange-400' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-[13px]">{doc.docName}</span>
                      <span className="text-[10px] text-brutal-ink/50 font-display">{doc.docType}</span>
                    </div>
                    {doc.expiresAt && (
                      <div className={`text-[11px] font-bold ${expiryUrgent ? 'text-orange-600' : 'text-brutal-ink/50'}`}>
                        Expires: {format(new Date(doc.expiresAt), 'dd MMM yyyy')}
                        {daysToExpiry !== null && daysToExpiry <= 30 && ` (${daysToExpiry}d left)`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={doc.status}
                      onChange={e => updateStatus({ id: doc.id, status: e.target.value })}
                      className={`text-[10px] font-display font-bold px-2 py-0.5 border outline-none cursor-pointer ${DOC_STATUS_COLOR[doc.status] ?? ''}`}
                    >
                      {['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {doc.fileS3Key ? (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/company-documents/${companyId}/${doc.id}/download`}
                        target="_blank"
                        className="brutal-border w-7 h-7 grid place-items-center hover:bg-brutal-yellow">
                        <Download size={12} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-brutal-ink/30 font-display">No file</span>
                    )}
                  </div>
                </div>
                {doc.notes && <p className="text-[11px] text-brutal-ink/60 mt-1">{doc.notes}</p>}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

// ── Communications Tab ────────────────────────────────────────────────────────
const COMM_ICONS: Record<string, string> = {
  EMAIL: '📧', PHONE_CALL: '📞', WHATSAPP: '💬',
  IN_PERSON: '🤝', VIDEO_CALL: '📹', LETTER: '✉️',
};
const COMM_TYPES = ['EMAIL', 'PHONE_CALL', 'WHATSAPP', 'IN_PERSON', 'VIDEO_CALL', 'LETTER'];

function CommunicationsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'PHONE_CALL',
    commDate: format(new Date(), 'yyyy-MM-dd'),
    summary: '',
    outcome: '',
    nextAction: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['client-comms', companyId],
    queryFn: () => apiClient.get(`/client-communications/${companyId}`).then(r => r.data),
  });

  const { mutate: addComm, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/client-communications/${companyId}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-comms', companyId] });
      qc.invalidateQueries({ queryKey: ['company', companyId] });
      setShowForm(false);
      setForm({ type: 'PHONE_CALL', commDate: format(new Date(), 'yyyy-MM-dd'), summary: '', outcome: '', nextAction: '' });
    },
  });

  const comms = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-display font-bold text-[11px] tracking-widest uppercase text-brutal-ink/60">
          {data?.total ?? 0} communication{(data?.total ?? 0) !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={13} /> Log Communication
        </Button>
      </div>

      {showForm && (
        <div className="brutal-border p-4 bg-brutal-surface space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
                {COMM_TYPES.map(t => <option key={t} value={t}>{COMM_ICONS[t]} {t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Date</label>
              <input type="date" value={form.commDate} onChange={e => setForm(f => ({ ...f, commDate: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div className="col-span-2">
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Summary *</label>
              <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={2} placeholder="What was discussed?" className="w-full brutal-border p-2 text-sm font-display outline-none bg-white resize-none" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Outcome</label>
              <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
            <div>
              <label className="font-display font-bold text-[10px] uppercase text-brutal-ink/60 block mb-1">Next Action</label>
              <input value={form.nextAction} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.summary.trim() || isPending} onClick={() => addComm()}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? <div className="h-20 brutal-border bg-brutal-surface animate-pulse" /> :
        comms.length === 0 ? <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No communications logged</div> :
        <div className="space-y-2">
          {comms.map((c: any) => (
            <div key={c.id} className="brutal-border p-3 bg-white flex gap-3">
              <div className="text-2xl flex-shrink-0 mt-0.5">{COMM_ICONS[c.type] ?? '💬'}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-display font-bold text-[11px] text-brutal-ink/60 uppercase">{c.type.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-brutal-ink/40">{c.author.firstName} {c.author.lastName}</span>
                    <span className="text-[10px] text-brutal-ink/40">{format(new Date(c.commDate), 'dd MMM yyyy')}</span>
                  </div>
                </div>
                <p className="text-[13px] font-display">{c.summary}</p>
                {c.outcome && <p className="text-[11px] text-brutal-ink/60 mt-0.5">→ {c.outcome}</p>}
                {c.nextAction && <p className="text-[11px] text-brutal-blue font-bold mt-0.5">Next: {c.nextAction}</p>}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
