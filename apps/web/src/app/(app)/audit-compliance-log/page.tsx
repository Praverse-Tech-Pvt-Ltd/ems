'use client';

import { useState, useEffect } from 'react';
import { auditLogsService, calendarService } from '@/lib/api/management';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  APPROVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  UPDATE: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  LOGIN: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  DELETE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  REJECT: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  LOGOUT: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export default function AuditComplianceLogPage() {
  const queryClient = useQueryClient();
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
        isAdmin ? queryClient.fetchQuery({ queryKey: ['audit-logs', cur, resourceFilter], queryFn: () => auditLogsService.list({ limit: 30, cursor: cur, resourceType: resourceFilter || undefined }) }).catch(() => ({ data: [], nextCursor: null })) : Promise.resolve({ data: [], nextCursor: null }),
        queryClient.fetchQuery({ queryKey: ['audit-countdowns'], queryFn: () => calendarService.auditCountdowns() }).catch(() => []),
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
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.createdAt).toDateString() === todayStr);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] text-center p-6 bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
        <span className="material-symbols-outlined text-[48px] text-rose-500 fill animate-pulse">lock</span>
        <h3 className="font-extrabold text-base text-slate-800 dark:text-white mt-3">Access Restriction Alert</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
          System audit logs are encrypted and restricted. You need Admin or Super Admin credentials to view operations telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-sm">
        <div className="font-label-caps text-label-caps text-indigo-500 dark:text-indigo-400 tracking-widest flex items-center gap-xs mb-xs font-bold">
          <span className="material-symbols-outlined text-[18px]">security</span>
          AUDIT LOGS
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-slate-800 dark:text-white hidden md:block">Audit & Compliance Log</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-slate-800 dark:text-white md:hidden">System Audit Log</h2>
            <p className="text-slate-400 dark:text-slate-500 mt-xs text-sm">Review full PostgreSQL operational logs, actor references, and IP addresses.</p>
          </div>
        </div>
      </div>

      {/* Stats and Countdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-lg">
        {/* Statistics Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {[
              { label: 'Total Sync Logs', value: logs.length, color: 'text-indigo-500', icon: 'list_alt', bg: 'bg-indigo-500/10' },
              { label: 'Logs Today', value: todayLogs.length, color: 'text-emerald-500', icon: 'today', bg: 'bg-emerald-500/10' },
              { label: 'Deletes Flagged', value: todayLogs.filter(l => l.action === 'DELETE').length, color: 'text-rose-500', icon: 'delete', bg: 'bg-rose-500/10' },
              { label: 'Active Actors', value: new Set(logs.map(l => l.actorId)).size, color: 'text-amber-500', icon: 'person', bg: 'bg-amber-500/10' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-[#111c2e] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between min-h-[120px] hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.color}`}>
                    <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                  </div>
                </div>
                <p className="font-extrabold text-xl text-slate-800 dark:text-white mt-3 font-mono">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Audit Countdowns */}
        {countdowns.length > 0 && (
          <div className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-3">Upcoming Milestones</p>
            <div className="space-y-3">
              {countdowns.slice(0, 3).map((a: any, i) => {
                const isUrgent = (a.daysLeft ?? 30) <= 14;
                return (
                  <div key={i} className="flex items-center gap-sm">
                    <div className={`text-xl font-extrabold w-10 text-center font-mono ${isUrgent ? 'text-rose-500' : 'text-slate-500 dark:text-slate-300'}`}>
                      {a.daysLeft ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0 border-l border-slate-100 dark:border-slate-800 pl-3">
                      <p className="font-bold text-xs text-slate-800 dark:text-white truncate">{a.title ?? a.label}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{a.daysLeft} days remaining</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resource filter tabs */}
      <div className="flex gap-2 flex-wrap items-center bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 p-2.5 rounded-3xl shadow-sm">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2.5">Filter category:</span>
        <button 
          onClick={() => setResourceFilter('')}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${!resourceFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          ALL EVENTS
        </button>
        {resourceTypes.map(r => (
          <button 
            key={r} 
            onClick={() => setResourceFilter(r === resourceFilter ? '' : r)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${resourceFilter === r ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Logs Table Ledger */}
      {loading ? (
        <div className="flex flex-col gap-sm">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 rounded-3xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-lg text-center text-slate-400 dark:text-slate-500 text-sm">
          No system audit logs found matching the filters.
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#111c2e] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-bold tracking-wider">
                    <th className="p-4">Log ID</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target Resource</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {logs.map(log => {
                    const actorName = `${log.actor?.firstName ?? 'System'} ${log.actor?.lastName ?? 'Auto-Cron'}`;
                    const initials = `${log.actor?.firstName?.[0] || 'S'}${log.actor?.lastName?.[0] || 'A'}`;
                    const badgeClass = ACTION_COLOR[log.action] || 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                        <td className="p-4 font-mono text-slate-400">#00{log.id?.slice(-4) ?? '00'}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[9px] shrink-0 border border-slate-200 dark:border-slate-700">
                              {initials}
                            </div>
                            <span className="font-bold">{actorName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold ${badgeClass}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-white text-[11px]">{log.resourceType}</span>
                            {log.resourceId && (
                              <span className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">{log.resourceId}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{log.ipAddress ?? 'localhost'}</td>
                        <td className="p-4 text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {hasMore && (
            <button 
              onClick={() => load(cursor)} 
              className="self-center mt-4 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs px-5 py-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              Load More logs
            </button>
          )}
        </>
      )}
    </div>
  );
}
