'use client';

import { useState, useEffect } from 'react';
import { auditLogsService, calendarService } from '@/lib/api/management';
import { useAuthStore } from '@/store/auth.store';

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  UPDATE: 'bg-primary/10 text-primary border-primary/20',
  DELETE: 'bg-error/10 text-error border-error/20',
  APPROVE: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  REJECT: 'bg-error/10 text-error border-error/20',
  LOGIN: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
  LOGOUT: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
};

export default function AuditComplianceLogPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const [logs, setLogs] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const load = async (cur?: string) => {
    try {
      const [logsData, cntd] = await Promise.all([
        isAdmin ? auditLogsService.list({ limit: 30, cursor: cur, resourceType: resourceFilter || undefined }).catch(() => ({ data: [], nextCursor: null })) : Promise.resolve({ data: [], nextCursor: null }),
        calendarService.auditCountdowns().catch(() => []),
      ]);
      const newLogs = Array.isArray(logsData) ? logsData : logsData?.data ?? [];
      if (cur) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
      setCursor(logsData?.nextCursor);
      setHasMore(!!logsData?.nextCursor);
      setCountdowns(Array.isArray(cntd) ? cntd : cntd?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [resourceFilter]);

  const resourceTypes = ['EMPLOYEE', 'ATTENDANCE', 'LEAVE', 'EXPENSE', 'SALARY', 'CLIENT', 'INVOICE'];

  // Aggregate stats from logs
  const today = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.createdAt).toDateString() === today);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-md text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">lock</span>
        <p className="text-on-surface-variant">Audit logs are only visible to Admins and Super Admins.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          AUDIT
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Audit & Compliance Log</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Audit Log</h2>
            <p className="text-on-surface-variant mt-xs">Complete immutable log of every action in the system.</p>
          </div>
        </div>
      </div>

      {/* Audit countdowns + quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-lg">
        {/* Quick stats */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {[
              { label: 'Total Logs', value: logs.length, color: 'text-primary', icon: 'list_alt' },
              { label: 'Today', value: todayLogs.length, color: 'text-tertiary', icon: 'today' },
              { label: 'Deletes Today', value: todayLogs.filter(l => l.action === 'DELETE').length, color: 'text-error', icon: 'delete' },
              { label: 'Unique Actors', value: new Set(logs.map(l => l.actorId)).size, color: 'text-on-surface', icon: 'person' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex flex-col gap-sm">
                <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-body-sm text-on-surface-variant">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Audit countdowns */}
        {countdowns.length > 0 && (
          <div className="glass-card rounded-2xl p-md border border-outline-variant/30">
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-md">UPCOMING AUDITS</p>
            <div className="flex flex-col gap-sm">
              {countdowns.slice(0, 3).map((a: any, i) => (
                <div key={i} className="flex items-center gap-sm">
                  <div className={`text-2xl font-black w-12 text-center ${(a.daysLeft ?? 30) <= 14 ? 'text-error' : (a.daysLeft ?? 30) <= 30 ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {a.daysLeft ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0 border-l border-outline-variant/30 pl-sm">
                    <p className="font-semibold text-on-surface text-sm truncate">{a.title ?? a.label}</p>
                    <p className="text-[10px] text-on-surface-variant">{a.daysLeft} days remaining</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-xs flex-wrap items-center">
        <span className="text-body-sm text-on-surface-variant">Filter:</span>
        <button onClick={() => setResourceFilter('')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-label-caps border transition-all ${!resourceFilter ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
          All
        </button>
        {resourceTypes.map(r => (
          <button key={r} onClick={() => setResourceFilter(r === resourceFilter ? '' : r)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-label-caps border transition-all ${resourceFilter === r ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
            {r}
          </button>
        ))}
      </div>

      {/* Logs table */}
      {loading ? (
        <div className="flex flex-col gap-xs">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-xl bg-surface-container-high animate-pulse" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          No audit logs found.
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="hidden md:grid grid-cols-[140px_1fr_1fr_100px_120px] gap-sm px-md py-2 bg-surface-container-low border-b border-outline-variant/20">
              {['Time', 'Actor', 'Resource', 'Action', 'IP'].map(h => (
                <span key={h} className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-outline-variant/20">
              {logs.map(log => (
                <div key={log.id} className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_100px_120px] gap-sm items-center p-sm hover:bg-surface-container-low transition-colors">
                  <p className="text-[10px] text-on-surface-variant tabular-nums">
                    {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                  <div className="flex items-center gap-xs">
                    <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[9px] shrink-0">
                      {log.actor?.firstName?.[0]}{log.actor?.lastName?.[0]}
                    </div>
                    <p className="text-body-sm text-on-surface truncate">{log.actor?.firstName} {log.actor?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-body-sm text-on-surface">{log.resourceType}</p>
                    {log.resourceId && <p className="text-[9px] text-on-surface-variant font-mono truncate">{log.resourceId}</p>}
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border w-fit ${ACTION_COLOR[log.action] ?? 'bg-surface-container-high text-on-surface-variant border-outline-variant/30'}`}>
                    {log.action}
                  </span>
                  <p className="text-[10px] text-on-surface-variant font-mono hidden md:block truncate">{log.ipAddress ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {hasMore && (
            <button onClick={() => load(cursor)} className="self-center border border-outline-variant/50 text-on-surface-variant font-label-caps text-label-caps px-lg py-2 rounded-full hover:bg-surface-container-low hover:text-primary transition-colors">
              Load More
            </button>
          )}
        </>
      )}
    </div>
  );
}
