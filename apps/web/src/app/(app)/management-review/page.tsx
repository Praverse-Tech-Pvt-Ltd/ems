'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart2, AlertTriangle, Calendar, Users, BrainCircuit, RefreshCw, Clock, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

const STATUS_BG: Record<string, string> = {
  ACTIVE: 'bg-green-50 border-green-200', AT_RISK: 'bg-red-50 border-red-200',
  DELAYED: 'bg-orange-50 border-orange-200', DORMANT: 'bg-purple-50 border-purple-200',
  LOST: 'bg-gray-100 border-gray-200',
};

export default function ManagementReviewPage() {
  const [aiRec, setAiRec] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['management-review'],
    queryFn: () => apiClient.get('/management-review/weekly').then(r => r.data),
  });

  const { mutate: getAI, isPending: loadingAI } = useMutation({
    mutationFn: () => apiClient.get('/management-review/ai-recommendations').then(r => r.data),
    onSuccess: (text: string) => setAiRec(text),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 brutal-border bg-brutal-surface animate-pulse" />)}
      </div>
    );
  }

  if (!data) return null;
  const { summary, urgentAttention, noRecentActivity, upcomingAudits, delayed, employeeContributions, upcomingCalendarEvents, weekRange } = data;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Management Review"
        subtitle={`Week: ${weekRange.start} to ${weekRange.end}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
            <Button size="sm" onClick={() => getAI()} disabled={loadingAI}>
              <BrainCircuit size={14} /> {loadingAI ? 'Generating…' : 'AI Recommendations'}
            </Button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {[
          { label: 'Companies', value: summary.totalCompanies },
          { label: 'Active', value: summary.active },
          { label: 'At Risk', value: summary.atRisk, alert: summary.atRisk > 0 },
          { label: 'Dormant', value: summary.dormant },
          { label: 'Updates', value: summary.updatesThisWeek },
          { label: 'Pending Notes', value: summary.pendingMeetingNotes, alert: summary.pendingMeetingNotes > 0 },
          { label: 'Pending Updates', value: summary.pendingWorkUpdates, alert: summary.pendingWorkUpdates > 0 },
        ].map(k => (
          <div key={k.label} className={`brutal-border p-3 ${k.alert ? 'bg-orange-50 border-orange-400' : 'bg-brutal-surface'}`}>
            <div className="font-display font-bold text-2xl">{k.value}</div>
            <div className="font-display font-bold text-[9px] tracking-widest uppercase text-brutal-ink/60">{k.label}</div>
          </div>
        ))}
      </div>

      {/* AI recommendations */}
      {aiRec && (
        <div className="mb-5 bg-purple-50 border-2 border-purple-300 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={14} className="text-purple-700" />
            <span className="font-display font-bold text-[11px] tracking-widest uppercase text-purple-700">AI Recommendations</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{aiRec}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Urgent Attention */}
        <section>
          <SectionHeader icon={<AlertTriangle size={14} />} title="Urgent Attention" count={urgentAttention.length} color="text-brutal-red" />
          <div className="space-y-2">
            {urgentAttention.length === 0 && <EmptyState message="All good — no urgent items" green />}
            {urgentAttention.map((c: any) => (
              <Link href={`/companies/${c.id}`} key={c.id}>
                <div className={`brutal-border p-3 ${STATUS_BG[c.businessStatus] ?? 'bg-white'} flex items-center justify-between hover:shadow-sm`}>
                  <div>
                    <div className="font-display font-bold text-[13px]">{c.name}</div>
                    <div className="text-[11px] text-brutal-ink/60 mt-0.5">
                      {c.businessStatus} · Risk {c.riskScore}
                      {c.responsibleEmployee && ` · ${c.responsibleEmployee.firstName}`}
                    </div>
                    {c.alerts?.slice(0, 1).map((a: any) => (
                      <div key={a.id} className="text-[10px] text-brutal-red mt-0.5">⚠ {a.message}</div>
                    ))}
                  </div>
                  <ChevronRight size={14} className="text-brutal-ink/40 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* No Recent Activity */}
        <section>
          <SectionHeader icon={<Clock size={14} />} title="No Recent Activity" count={noRecentActivity.length} color="text-orange-600" />
          <div className="space-y-2">
            {noRecentActivity.length === 0 && <EmptyState message="All companies have recent activity" green />}
            {noRecentActivity.map((c: any) => (
              <Link href={`/companies/${c.id}`} key={c.id}>
                <div className="brutal-border p-3 bg-white flex items-center justify-between hover:bg-brutal-surface">
                  <div>
                    <div className="font-display font-bold text-[13px]">{c.name}</div>
                    <div className="text-[11px] text-brutal-ink/60">
                      Last comm: {c.lastCommunicationDate ? format(new Date(c.lastCommunicationDate), 'dd MMM') : 'Never'}
                      {c.responsibleEmployee && ` · ${c.responsibleEmployee.firstName}`}
                    </div>
                  </div>
                  <div className={`font-display font-bold text-lg ${c.daysSinceComm >= 30 ? 'text-brutal-red' : 'text-orange-500'}`}>
                    {c.daysSinceComm}d
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Upcoming Audits */}
        <section>
          <SectionHeader icon={<Calendar size={14} />} title="Upcoming Audits (60 days)" count={upcomingAudits.length} color="text-blue-700" />
          <div className="space-y-2">
            {upcomingAudits.length === 0 && <EmptyState message="No upcoming audits" />}
            {upcomingAudits.map((c: any) => (
              <Link href={`/companies/${c.id}`} key={c.id}>
                <div className={`brutal-border p-3 ${c.daysUntilAudit <= 7 ? 'bg-red-50 border-brutal-red' : c.daysUntilAudit <= 30 ? 'bg-orange-50 border-orange-400' : 'bg-white'} flex items-center justify-between`}>
                  <div>
                    <div className="font-display font-bold text-[13px]">{c.name}</div>
                    <div className="text-[11px] text-brutal-ink/60">{format(new Date(c.nextAuditDate), 'EEEE dd MMM yyyy')}</div>
                  </div>
                  <div className={`font-display font-bold text-lg ${c.daysUntilAudit <= 7 ? 'text-brutal-red' : c.daysUntilAudit <= 30 ? 'text-orange-600' : 'text-brutal-ink'}`}>
                    {c.daysUntilAudit === 0 ? 'TODAY' : `${c.daysUntilAudit}d`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Employee Contributions */}
        <section>
          <SectionHeader icon={<Users size={14} />} title="Employee Work (This Week)" count={employeeContributions.length} color="text-green-700" />
          <div className="space-y-2">
            {employeeContributions.length === 0 && <EmptyState message="No updates submitted this week" />}
            {employeeContributions.map((e: any) => (
              <div key={e.name} className="brutal-border p-3 bg-white flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[13px]">{e.name}</div>
                  <div className="text-[11px] text-brutal-ink/60">{e.companies.join(', ')}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-xl text-green-700">{e.count}</div>
                  <div className="text-[9px] text-brutal-ink/40">updates</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Upcoming Calendar Events */}
      {upcomingCalendarEvents?.length > 0 && (
        <section className="mt-5">
          <SectionHeader icon={<Calendar size={14} />} title="Next 14 Days — Calendar" count={upcomingCalendarEvents.length} color="text-brutal-blue" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {upcomingCalendarEvents.map((e: any) => (
              <div key={e.id} className="brutal-border p-3 bg-white">
                <div className="font-display font-bold text-[12px]">{e.title}</div>
                <div className="text-[11px] text-brutal-ink/60">
                  {format(new Date(e.startDate), 'EEE dd MMM, HH:mm')}
                  {e.company && ` · ${e.company.name}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delayed */}
      {delayed.length > 0 && (
        <section className="mt-5">
          <SectionHeader icon={<AlertTriangle size={14} />} title="Delayed / At Risk" count={delayed.length} color="text-orange-600" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {delayed.map((c: any) => (
              <Link href={`/companies/${c.id}`} key={c.id}>
                <div className="brutal-border p-3 bg-orange-50 border-orange-300 flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-[13px]">{c.name}</div>
                    <div className="text-[11px] text-orange-700">{c.businessStatus}</div>
                  </div>
                  <ChevronRight size={14} className="text-orange-400" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, count, color }: { icon: React.ReactNode; title: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 mb-2 ${color}`}>
      {icon}
      <span className="font-display font-bold text-[11px] tracking-widest uppercase">{title}</span>
      <span className="font-display font-bold text-[11px] bg-current text-white px-1.5 rounded-sm opacity-80">{count}</span>
    </div>
  );
}

function EmptyState({ message, green }: { message: string; green?: boolean }) {
  return (
    <div className={`brutal-border p-4 text-center font-display font-bold text-[12px] ${green ? 'bg-green-50 text-green-700' : 'bg-brutal-surface text-brutal-ink/40'}`}>
      {green ? '✓ ' : ''}{message}
    </div>
  );
}
