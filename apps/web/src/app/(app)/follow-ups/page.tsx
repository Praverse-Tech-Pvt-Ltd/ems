'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, Clock, Building2, User, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';

const STATUS_STYLE: Record<string, string> = {
  OPEN:    'bg-red-50 border-brutal-red',
  SNOOZED: 'bg-yellow-50 border-yellow-400',
  DONE:    'bg-green-50 border-green-300 opacity-60',
};

const REASON_COLOR = (reason: string) => {
  if (reason.includes('CRITICAL')) return 'text-brutal-red font-bold';
  if (reason.includes('MODERATE')) return 'text-orange-600 font-bold';
  return 'text-brutal-ink/70';
};

function TaskCard({ task, onComplete, onSnooze }: {
  task: any;
  onComplete: (id: string, note: string) => void;
  onSnooze: (id: string, date: string) => void;
}) {
  const [showComplete, setShowComplete] = useState(false);
  const [note, setNote] = useState('');
  const [snoozeDate, setSnoozeDate] = useState('');
  const daysOverdue = differenceInDays(new Date(), new Date(task.dueDate));

  return (
    <div className={`brutal-border p-4 ${STATUS_STYLE[task.status] ?? 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <Link href={`/companies/${task.company.id}`}>
            <div className="flex items-center gap-2 mb-1 hover:text-brutal-blue transition-colors">
              <Building2 size={12} className="text-brutal-ink/50" />
              <span className="font-display font-bold text-[13px]">{task.company.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                task.company.criticality === 'HIGH' ? 'bg-red-50 border-red-300 text-red-700' :
                task.company.criticality === 'MEDIUM' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' :
                'bg-green-50 border-green-300 text-green-700'
              }`}>{task.company.criticality}</span>
            </div>
          </Link>
          <p className={`text-[12px] ${REASON_COLOR(task.reason)}`}>{task.reason}</p>
          {task.assignee && (
            <div className="flex items-center gap-1 mt-1 text-[11px] text-brutal-ink/60">
              <User size={10} /> {task.assignee.firstName} {task.assignee.lastName}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-display font-bold text-lg ${daysOverdue > 0 ? 'text-brutal-red' : 'text-brutal-ink'}`}>
            {daysOverdue > 0 ? `${daysOverdue}d overdue` : format(new Date(task.dueDate), 'dd MMM')}
          </div>
          <div className="text-[9px] text-brutal-ink/40 font-display">{task.status}</div>
        </div>
      </div>

      {task.status === 'OPEN' && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-brutal-ink/10">
          <button
            onClick={() => setShowComplete(!showComplete)}
            className="flex items-center gap-1 text-[11px] font-display font-bold text-green-700 hover:text-green-900 border border-green-400 px-2 py-1 bg-white hover:bg-green-50"
          >
            <CheckCircle size={11} /> Complete
          </button>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={snoozeDate}
              onChange={e => setSnoozeDate(e.target.value)}
              className="brutal-border text-[11px] font-display px-2 py-1 outline-none bg-white"
            />
            <button
              onClick={() => snoozeDate && onSnooze(task.id, snoozeDate)}
              disabled={!snoozeDate}
              className="text-[11px] font-display font-bold border border-yellow-400 px-2 py-1 bg-white hover:bg-yellow-50 disabled:opacity-40"
            >
              <Clock size={11} className="inline mr-1" />Snooze
            </button>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What did you do? (auto-creates work update)"
            className="flex-1 brutal-border text-sm font-display px-2 py-1.5 outline-none bg-white"
          />
          <button
            onClick={() => { onComplete(task.id, note); setShowComplete(false); setNote(''); }}
            disabled={!note.trim()}
            className="px-3 py-1.5 bg-green-600 text-white font-display font-bold text-[11px] border-2 border-green-700 hover:bg-green-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}

      {task.status === 'DONE' && task.completionNote && (
        <div className="mt-2 text-[11px] text-green-700 bg-green-50 px-2 py-1">
          ✓ {task.completionNote}
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';
  const [filter, setFilter] = useState<'OPEN' | 'SNOOZED' | 'DONE' | ''>('OPEN');
  const [myOnly, setMyOnly] = useState(false);
  const qc = useQueryClient();

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['follow-up-tasks', filter, myOnly],
    queryFn: () => apiClient.get('/follow-up-tasks', {
      params: { status: filter || undefined, assignedToMe: myOnly || undefined },
    }).then(r => r.data),
  });

  const { mutate: complete } = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.patch(`/follow-up-tasks/${id}/complete`, { completionNote: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-tasks'] }),
  });

  const { mutate: snooze } = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      apiClient.patch(`/follow-up-tasks/${id}/snooze`, { snoozedUntil: date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-tasks'] }),
  });

  const { mutate: runCheck, isPending: runningCheck } = useMutation({
    mutationFn: () => apiClient.post('/follow-up-tasks/run-check'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-tasks'] }),
  });

  // Group by company
  const grouped: Record<string, any[]> = {};
  for (const t of tasks as any[]) {
    const key = t.company.name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(t);
  }

  const openCount = tasks.filter((t: any) => t.status === 'OPEN').length;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Follow-Up Tasks"
        subtitle="Auto-generated from stale client communications — mark done to log work update"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} />
            </Button>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => runCheck()} disabled={runningCheck}>
                {runningCheck ? 'Running…' : 'Run Check Now'}
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Open', value: tasks.filter((t: any) => t.status === 'OPEN').length, color: 'bg-red-50 border-brutal-red' },
          { label: 'Snoozed', value: tasks.filter((t: any) => t.status === 'SNOOZED').length, color: 'bg-yellow-50 border-yellow-400' },
          { label: 'Done (all)', value: tasks.filter((t: any) => t.status === 'DONE').length, color: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`brutal-border p-3 ${s.color}`}>
            <div className="font-display font-bold text-2xl">{s.value}</div>
            <div className="font-display text-[10px] tracking-widest uppercase text-brutal-ink/60">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex brutal-border overflow-hidden">
          {(['OPEN', 'SNOOZED', 'DONE', ''] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 font-display font-bold text-[11px] uppercase transition-colors ${filter === s ? 'bg-brutal-ink text-white' : 'bg-white hover:bg-brutal-surface'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMyOnly(!myOnly)}
          className={`brutal-border px-3 py-1.5 text-[11px] font-display font-bold transition-colors ${myOnly ? 'bg-brutal-blue text-white' : 'bg-white'}`}
        >
          My Tasks
        </button>
      </div>

      {/* Task list grouped by company */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 brutal-border bg-brutal-surface animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="brutal-border p-12 text-center bg-green-50">
          <CheckCircle size={36} className="mx-auto mb-3 text-green-500" />
          <p className="font-display font-bold text-green-700">No {filter || ''} follow-up tasks</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([company, compTasks]) => (
            <div key={company}>
              <div className="font-display font-bold text-[11px] tracking-widest uppercase text-brutal-ink/60 mb-2 flex items-center gap-2">
                <Building2 size={11} /> {company}
                <span className="bg-brutal-ink text-white text-[9px] px-1.5 py-0.5">{compTasks.length}</span>
              </div>
              <div className="space-y-2">
                {compTasks.map((t: any) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onComplete={(id, note) => complete({ id, note })}
                    onSnooze={(id, date) => snooze({ id, date })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
