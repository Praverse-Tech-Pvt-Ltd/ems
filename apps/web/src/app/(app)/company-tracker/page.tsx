'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, RefreshCw, Save } from 'lucide-react';
import { companyTrackerService } from '@/lib/api/company-tracker';
import { useAuthStore } from '@/store/auth.store';

const STATUS_CLASS: Record<string, string> = {
  'Not Started': 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20',
  'In Progress': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'Submitted for Review': 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  'Review Comments Received': 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  'Correction Required': 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  Completed: 'bg-success/10 text-success border-success/20',
  Delayed: 'bg-error/10 text-error border-error/20',
  Closed: 'bg-emerald-900/10 text-emerald-900 border-emerald-900/20',
  'On Hold': 'bg-purple-500/10 text-purple-700 border-purple-500/20',
};

const STAGE_OPTIONS = ['Not Started', 'Data Awaited', 'Under Review', 'Query Raised', 'In Progress', 'Sent to Client', 'Client Feedback Awaited', 'Revised', 'Completed', 'On Hold', 'Delayed', 'Closed'];
const REQUIREMENT_STATUS = ['Not Started', 'In Progress', 'Submitted for Review', 'Review Comments Received', 'Correction Required', 'Completed', 'Sent to Client', 'Client Feedback Awaited', 'Closed', 'Delayed'];

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10.5px] font-bold ${STATUS_CLASS[value] ?? 'bg-surface-container text-on-surface border-card-border'}`}>{value}</span>;
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="text-[26px] font-black text-on-surface mt-2">{value}</p>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-[11px] font-bold text-on-surface">{value}%</span>
    </div>
  );
}

function TaskUpdate({ task, onSaved }: { task: any; onSaved: () => void }) {
  const [status, setStatus] = useState(task.status);
  const [completion, setCompletion] = useState(task.completionPercent ?? 0);
  const [remarks, setRemarks] = useState(task.remarks ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await companyTrackerService.updateRequirement(task.id, { status, completionPercent: completion, remarks });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={status} onChange={e => setStatus(e.target.value)} className="min-h-11 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs">
        {REQUIREMENT_STATUS.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <input type="number" min={0} max={100} value={completion} onChange={e => setCompletion(Number(e.target.value))} className="min-h-11 w-20 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs" />
      <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks" className="min-h-11 min-w-[160px] flex-1 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs" />
      <button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
        <Save size={12} /> Save
      </button>
    </div>
  );
}

export default function CompanyTrackerPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', priority: '', status: '', delayedOnly: false });

  const load = async () => {
    setLoading(true);
    try {
      const response = await companyTrackerService.dashboard({
        search: filters.search || undefined,
        priority: filters.priority || undefined,
        status: filters.status || undefined,
        delayedOnly: filters.delayedOnly || undefined,
      });
      setData(response);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    const blob = await companyTrackerService.exportReport('management-summary');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'company-tracker-management-summary.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); }, []);

  const projects = data?.companyProgress ?? [];
  const tasks = useMemo(() => projects.flatMap((p: any) => (p.requirements ?? []).map((r: any) => ({ ...r, project: p }))), [projects]);
  const visibleTasks = isAdmin ? tasks : tasks.filter((task: any) => task.assignedTo === user?.id);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-black text-on-surface">Company Tracker</h1>
          <p className="text-sm text-on-surface-variant mt-1">Client project tracking for audits, QMS, SOPs, validation, BMR review, gap assessment, and follow-ups.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={downloadReport} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-xl border border-card-border text-sm font-semibold">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={load} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Search company..." className="min-h-11 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-sm" />
        <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })} className="min-h-11 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-sm">
          <option value="">All priorities</option>
          {['Critical', 'High', 'Medium', 'Low'].map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="min-h-11 rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-sm">
          <option value="">All stages</option>
          {STAGE_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={load} className="min-h-11 rounded-lg bg-surface-container px-3 py-2 text-sm font-bold text-on-surface">Apply Filters</button>
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-8 text-center text-on-surface-variant">Loading tracker...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label={isAdmin ? 'Total Active Companies' : 'My Companies'} value={data?.cards?.totalActiveCompanies ?? 0} />
            <Card label={isAdmin ? 'Total Projects' : 'My Pending Tasks'} value={isAdmin ? data?.cards?.totalProjects ?? 0 : data?.cards?.pendingTasks ?? 0} />
            <Card label="Completed" value={isAdmin ? data?.cards?.projectsCompleted ?? 0 : data?.cards?.completedTasks ?? 0} />
            <Card label="Delayed" value={isAdmin ? data?.cards?.projectsDelayed ?? 0 : data?.cards?.delayedTasks ?? 0} />
            <Card label="Due This Week" value={data?.cards?.projectsDueThisWeek ?? data?.dueThisWeek?.length ?? 0} />
            <Card label="Today Follow-ups" value={data?.cards?.todayFollowUps ?? 0} />
            <Card label="Overdue Follow-ups" value={data?.cards?.overdueFollowUps ?? 0} />
            <Card label="Critical Priority" value={data?.cards?.criticalPriorityProjects ?? 0} />
          </div>

          {isAdmin && (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-card-border">
                <h2 className="font-bold text-on-surface">Company Progress</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                    <tr>{['Company', 'Goal', 'Project Type', 'Owner', 'Stage', 'Completion', 'Target', 'Delay', 'Priority', 'Next Follow-up', 'Status'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {projects.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-3 py-3 font-semibold"><Link href={`/company-tracker/${p.id}`}>{p.company?.name}</Link></td>
                        <td className="px-3 py-3">{p.regulatoryGoal}</td>
                        <td className="px-3 py-3">{p.projectType}</td>
                        <td className="px-3 py-3">{p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : '-'}</td>
                        <td className="px-3 py-3"><Badge value={p.currentStage} /></td>
                        <td className="px-3 py-3"><Progress value={p.completionPercent} /></td>
                        <td className="px-3 py-3">{fmtDate(p.targetCompletionDate)}</td>
                        <td className="px-3 py-3">{p.delayDays || '-'}</td>
                        <td className="px-3 py-3">{p.priority}</td>
                        <td className="px-3 py-3">{fmtDate(p.nextFollowUpDate)}</td>
                        <td className="px-3 py-3">{p.isAtRisk ? 'At Risk' : 'On Track'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-card-border">
              <h2 className="font-bold text-on-surface">{isAdmin ? 'Task / Requirement Tracker' : 'My Task List'}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <tr>{['Company', 'Requirement', 'Due Date', 'Status', 'Completion', 'Priority', 'Last Updated', 'Remarks / Action'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {visibleTasks.map((task: any) => (
                    <tr key={task.id}>
                      <td className="px-3 py-3">{task.project?.company?.name}</td>
                      <td className="px-3 py-3 font-medium">{task.description}</td>
                      <td className="px-3 py-3">{fmtDate(task.dueDate)}</td>
                      <td className="px-3 py-3"><Badge value={task.status} /></td>
                      <td className="px-3 py-3"><Progress value={task.completionPercent ?? 0} /></td>
                      <td className="px-3 py-3">{task.project?.priority}</td>
                      <td className="px-3 py-3">{fmtDate(task.lastUpdatedAt)}</td>
                      <td className="px-3 py-3"><TaskUpdate task={task} onSaved={load} /></td>
                    </tr>
                  ))}
                  {visibleTasks.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-on-surface-variant">No tracker tasks found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-4">
                <h2 className="font-bold text-on-surface mb-3">Employee Workload</h2>
                <div className="space-y-2">
                  {(data?.employeeWorkload ?? []).map((row: any) => (
                    <div key={row.employee.id} className="rounded-lg border border-card-border p-3 flex items-center justify-between gap-3">
                      <div><p className="font-semibold">{row.employee.firstName} {row.employee.lastName}</p><p className="text-xs text-on-surface-variant">{row.assignedCompanies} companies</p></div>
                      <p className="text-xs text-on-surface-variant">{row.pendingTasks} pending / {row.completedTasks} done / {row.delayedTasks} delayed</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <h2 className="font-bold text-on-surface mb-3">Escalations</h2>
                <div className="space-y-2">
                  {(data?.escalations ?? []).map((row: any) => (
                    <div key={row.id} className="rounded-lg border border-error/20 bg-error/5 p-3">
                      <p className="font-semibold">{row.project?.company?.name} - {row.description}</p>
                      <p className="text-xs text-on-surface-variant">{row.delayDays} days delayed · {row.project?.priority} · {row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : 'Unassigned'}</p>
                    </div>
                  ))}
                  {(data?.escalations ?? []).length === 0 && <p className="text-sm text-on-surface-variant">No escalations right now.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
