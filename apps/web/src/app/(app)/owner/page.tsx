'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BrainCircuit, AlertTriangle, Building2, Users, Calendar, RefreshCw, ChevronRight, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

const CRIT_COLOR: Record<string, string> = {
  HIGH: 'text-brutal-red', MEDIUM: 'text-orange-500', LOW: 'text-green-600',
};

const STATUS_BG: Record<string, string> = {
  ACTIVE: 'bg-green-50 border-green-200', AT_RISK: 'bg-red-50 border-red-200',
  DELAYED: 'bg-orange-50 border-orange-200', DORMANT: 'bg-purple-50 border-purple-200',
  LOST: 'bg-gray-100 border-gray-200',
};

export default function OwnerPage() {
  const [weeklyText, setWeeklyText] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'attention' | 'visits' | 'audits' | 'employees' | 'performance'>('attention');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => apiClient.get('/ai-overview/owner-dashboard').then(r => r.data),
    retry: false,
  });

  const { mutate: generateWeekly, isPending: generatingWeekly } = useMutation({
    mutationFn: () => apiClient.post('/ai-overview/weekly-summary').then(r => r.data),
    onSuccess: (text: string) => setWeeklyText(text),
  });

  const { data: employeeMap = [], isLoading: loadingMap } = useQuery({
    queryKey: ['employee-work-map'],
    queryFn: () => apiClient.get('/ai-overview/employee-work-map').then(r => r.data),
  });

  const { data: perfData } = useQuery({
    queryKey: ['employee-performance'],
    queryFn: () => apiClient.get('/management-review/employee-performance').then(r => r.data),
    enabled: activeSection === 'performance',
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 brutal-border bg-brutal-surface animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!isLoading && !data) {
    return (
      <div className="p-6">
        <div className="brutal-border p-8 text-center bg-red-50">
          <Star size={32} className="mx-auto mb-3 text-brutal-red" />
          <p className="font-display font-bold text-brutal-red">Owner access required</p>
          <p className="text-sm text-brutal-ink/60 mt-2">This page is restricted to Ashwani Shrivastav and Pratham Shrivastav only.</p>
        </div>
      </div>
    );
  }

  const {
    summary,
    needsImmediateAttention,
    notVisitedRecently,
    upcomingAudits,
    employeeContributions,
    pendingMeetingReviews,
    dailyBriefing,
    repeatedIssues = [],
    openFollowUps = [],
    teamWorkload = [],
  } = data;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Owner AI Dashboard"
        subtitle="Complete company intelligence — restricted to owners only"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
            <Link href="/chat-ai">
              <Button variant="secondary" size="sm" className="flex items-center gap-1">
                <BrainCircuit size={13} /> AI Chat
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => generateWeekly()}
              disabled={generatingWeekly}
              className="flex items-center gap-2"
            >
              <BrainCircuit size={14} />
              {generatingWeekly ? 'Generating…' : 'Weekly AI Summary'}
            </Button>
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[
          { label: 'Total Companies', value: summary.total, color: 'bg-brutal-surface' },
          { label: 'Active', value: summary.active, color: 'bg-green-50' },
          { label: 'At Risk', value: summary.atRisk, color: 'bg-red-50 border-red-300' },
          { label: 'High Priority', value: summary.high, color: 'bg-yellow-50' },
          { label: 'Dormant', value: summary.dormant, color: 'bg-purple-50' },
          { label: 'Pending Reviews', value: pendingMeetingReviews, color: pendingMeetingReviews > 0 ? 'bg-orange-50 border-orange-300' : 'bg-brutal-surface' },
          { label: 'Green', value: summary.green ?? 0, color: 'bg-green-50' },
          { label: 'Yellow', value: summary.yellow ?? 0, color: 'bg-yellow-50' },
          { label: 'Red', value: summary.red ?? 0, color: 'bg-red-50 border-red-300' },
        ].map(k => (
          <div key={k.label} className={`brutal-border p-3 ${k.color}`}>
            <div className="font-display font-bold text-2xl">{k.value}</div>
            <div className="font-display font-bold text-[9px] tracking-widest uppercase text-brutal-ink/60">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Daily briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="brutal-border p-4 bg-red-50">
          <div className="font-display font-bold text-[11px] tracking-widest uppercase mb-2">Daily Owner Briefing</div>
          <div className="text-xs font-bold">At-risk clients</div>
          <p className="text-xs text-brutal-ink/70 mt-1">{dailyBriefing?.atRiskClients?.join(', ') || 'None'}</p>
          <div className="text-xs font-bold mt-3">Stuck work</div>
          <p className="text-xs text-brutal-ink/70 mt-1">{dailyBriefing?.stuckWork?.join(', ') || 'None'}</p>
        </div>
        <div className="brutal-border p-4 bg-orange-50">
          <div className="font-display font-bold text-[11px] tracking-widest uppercase mb-2">Overdue Follow-ups</div>
          {(dailyBriefing?.overdueFollowUps ?? []).slice(0, 4).map((task: any) => (
            <div key={`${task.company}-${task.reason}`} className="text-xs border-b border-brutal-ink/10 py-1">
              <b>{task.company}</b>: {task.reason}
            </div>
          ))}
          {(dailyBriefing?.overdueFollowUps ?? []).length === 0 && <p className="text-xs text-brutal-ink/60">None overdue</p>}
        </div>
        <div className="brutal-border p-4 bg-brutal-surface">
          <div className="font-display font-bold text-[11px] tracking-widest uppercase mb-2">Call Prep</div>
          {(dailyBriefing?.nextCalls ?? []).slice(0, 3).map((item: any) => (
            <Link key={item.companyId} href={`/companies/${item.companyId}`}>
              <div className="text-xs border-b border-brutal-ink/10 py-1 hover:text-brutal-blue">
                <b>{item.company}</b>: {item.callSummary}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {(repeatedIssues.length > 0 || openFollowUps.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <div className="brutal-border p-4 bg-white">
            <div className="font-display font-bold text-[11px] tracking-widest uppercase mb-2">Repeated Issues</div>
            {repeatedIssues.slice(0, 6).map((issue: any) => (
              <div key={issue.companyId} className="text-xs py-1">
                <b>{issue.company}</b>: {issue.repeated.map((r: any) => `${r.keyword} x${r.count}`).join(', ')}
              </div>
            ))}
          </div>
          <div className="brutal-border p-4 bg-white">
            <div className="font-display font-bold text-[11px] tracking-widest uppercase mb-2">Team Workload</div>
            {teamWorkload.filter((e: any) => e.companiesResponsible.length || e.assignedFollowUps.length).slice(0, 6).map((emp: any) => (
              <div key={emp.id} className="text-xs py-1 flex justify-between gap-2">
                <span><b>{emp.firstName} {emp.lastName}</b></span>
                <span>{emp.companiesResponsible.length} clients / {emp.assignedFollowUps.length} follow-ups</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly AI summary */}
      {weeklyText && (
        <div className="mb-5 bg-purple-50 border-2 border-purple-300 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={14} className="text-purple-700" />
            <span className="font-display font-bold text-[11px] tracking-widest uppercase text-purple-700">AI Weekly Summary</span>
            <span className="text-[9px] text-purple-500">{format(new Date(), 'dd MMM yyyy')}</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{weeklyText}</p>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex border-b-2 border-brutal-ink mb-4 overflow-x-auto">
        {[
          { key: 'attention', label: 'Needs Attention', count: needsImmediateAttention.length },
          { key: 'visits', label: 'No Recent Visit', count: notVisitedRecently.length },
          { key: 'audits', label: 'Upcoming Audits', count: upcomingAudits.length },
          { key: 'employees', label: 'Employee Map', count: employeeContributions.length },
          { key: 'performance', label: 'Performance', count: 0 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSection(t.key as any)}
            className={`px-4 py-2 font-display font-bold text-[11px] tracking-widest uppercase border-r-2 border-brutal-ink whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeSection === t.key ? 'bg-brutal-ink text-white' : 'bg-white hover:bg-brutal-surface'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold ${activeSection === t.key ? 'bg-white text-brutal-ink' : 'bg-brutal-ink text-white'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Needs Attention */}
      {activeSection === 'attention' && (
        <div className="space-y-3">
          {needsImmediateAttention.length === 0 && (
            <div className="brutal-border p-8 text-center text-green-700 font-display font-bold bg-green-50">
              ✓ All companies are in good shape
            </div>
          )}
          {needsImmediateAttention.map((c: any) => (
            <Link href={`/companies/${c.id}`} key={c.id}>
              <div className={`brutal-border p-4 ${STATUS_BG[c.businessStatus] ?? 'bg-white'} hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-display font-bold text-[13px] ${CRIT_COLOR[c.criticality]}`}>●</span>
                      <span className="font-display font-bold">{c.name}</span>
                      <span className="text-[10px] font-bold px-1 border border-current">{c.businessStatus}</span>
                    </div>
                    {c.responsibleEmployee && (
                      <div className="text-[11px] text-brutal-ink/60 mt-1">
                        → {c.responsibleEmployee.firstName} {c.responsibleEmployee.lastName}
                      </div>
                    )}
                    {c.alerts?.map((a: any) => (
                      <div key={a.id} className="text-[11px] text-brutal-red mt-1">⚠ {a.message}</div>
                    ))}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xl font-display font-bold ${c.riskScore >= 60 ? 'text-brutal-red' : c.riskScore >= 30 ? 'text-orange-500' : 'text-green-600'}`}>
                      {c.riskScore}
                    </div>
                    <div className="text-[9px] text-brutal-ink/40 font-display">RISK</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-brutal-blue">
                  View company <ChevronRight size={10} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* No Recent Visit */}
      {activeSection === 'visits' && (
        <div className="space-y-2">
          {notVisitedRecently.length === 0 && (
            <div className="brutal-border p-8 text-center text-green-700 font-display font-bold bg-green-50">
              ✓ All companies visited recently
            </div>
          )}
          {notVisitedRecently.map((c: any) => (
            <Link href={`/companies/${c.id}`} key={c.id}>
              <div className="brutal-border p-3 bg-white hover:bg-brutal-surface flex items-center justify-between gap-3">
                <div>
                  <div className="font-display font-bold text-[13px]">{c.name}</div>
                  <div className="text-[11px] text-brutal-ink/60">
                    Last visit: {c.lastVisitDate ? format(new Date(c.lastVisitDate), 'dd MMM yyyy') : 'Never'}
                    {c.responsibleEmployee && ` · ${c.responsibleEmployee.firstName} ${c.responsibleEmployee.lastName}`}
                  </div>
                </div>
                <div className={`text-right flex-shrink-0 font-display font-bold text-lg ${c.daysSinceVisit >= 45 ? 'text-brutal-red' : c.daysSinceVisit >= 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                  {c.daysSinceVisit}d
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Upcoming Audits */}
      {activeSection === 'audits' && (
        <div className="space-y-3">
          {upcomingAudits.length === 0 && (
            <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No upcoming audits in 60 days</div>
          )}
          {upcomingAudits.map((c: any) => (
            <Link href={`/companies/${c.id}`} key={c.id}>
              <div className={`brutal-border p-4 bg-white ${c.daysToAudit <= 7 ? 'border-brutal-red bg-red-50' : c.daysToAudit <= 30 ? 'border-orange-400 bg-orange-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold">{c.name}</div>
                    <div className="text-[12px] text-brutal-ink/60">
                      {format(new Date(c.nextAuditDate), 'EEEE, dd MMMM yyyy')}
                    </div>
                    <div className={`text-[11px] font-bold mt-1 ${c.criticality === 'HIGH' ? 'text-brutal-red' : 'text-brutal-ink/60'}`}>
                      {c.criticality} PRIORITY
                    </div>
                  </div>
                  <div className={`text-2xl font-display font-bold ${c.daysToAudit <= 7 ? 'text-brutal-red' : c.daysToAudit <= 30 ? 'text-orange-600' : 'text-brutal-ink'}`}>
                    {c.daysToAudit === 0 ? 'TODAY' : `${c.daysToAudit}d`}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Employee Work Map */}
      {activeSection === 'employees' && (
        <div className="space-y-3">
          {(loadingMap ? [] : employeeMap).map((emp: any) => (
            <div key={emp.employee.id} className="brutal-border p-4 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-display font-bold">{emp.employee.firstName} {emp.employee.lastName}</div>
                  <div className="text-[11px] text-brutal-ink/60">{emp.employee.designation}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-xl">{emp.updateCount}</div>
                  <div className="text-[9px] text-brutal-ink/40">updates this week</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {emp.companies.map((c: any) => (
                  <Link key={c.id} href={`/companies/${c.id}`}>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-brutal-surface border border-brutal-ink/20 hover:bg-brutal-yellow transition-colors">
                      {c.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {employeeContributions.length === 0 && (
            <div className="brutal-border p-8 text-center text-brutal-ink/40 font-display">No employee updates this week</div>
          )}
        </div>
      )}

      {/* Performance section */}
      {activeSection === 'performance' && (
        <div className="space-y-4">
          {perfData?.aiSummary && (
            <div className="bg-purple-50 border-2 border-purple-300 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={13} className="text-purple-700" />
                <span className="font-display font-bold text-[11px] tracking-widest uppercase text-purple-700">AI Team Summary ({perfData.days}d)</span>
              </div>
              <p className="text-sm text-purple-900">{perfData.aiSummary}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(perfData?.report ?? []).map((r: any) => (
              <div key={r.employee.id} className="brutal-border p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-display font-bold">{r.employee.name}</div>
                    <div className="text-[11px] text-brutal-ink/50">{r.employee.designation}</div>
                  </div>
                  <div className={`font-display font-bold text-xl ${r.activityScore >= 20 ? 'text-green-600' : r.activityScore >= 10 ? 'text-orange-500' : 'text-brutal-ink/40'}`}>
                    {r.activityScore}
                    <div className="text-[9px] text-brutal-ink/40 font-normal">score</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Updates', value: r.updatesCount },
                    { label: 'Companies', value: r.companiesCovered },
                    { label: 'Visits', value: r.visitCount },
                    { label: 'Follow-ups', value: r.followUpCompleted },
                  ].map(s => (
                    <div key={s.label} className="text-center brutal-border p-1.5 bg-brutal-surface">
                      <div className="font-display font-bold text-lg">{s.value}</div>
                      <div className="font-display text-[8px] uppercase text-brutal-ink/50">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
