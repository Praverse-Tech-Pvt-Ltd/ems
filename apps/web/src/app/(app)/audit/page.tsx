'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Download } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  actor?: { firstName: string; lastName: string; employeeCode: string };
  newValue?: any;
  oldValue?: any;
}

const TONE_TAG: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

function actionTone(r: AuditLog): string {
  const a = r.action.toUpperCase();
  const nv = r.newValue;
  
  if (a.includes('MISSING')) return 'red';
  
  // Highlight manual or remote punches as hold/warning (Review Required)
  if ((a === 'PUNCH_IN' || a === 'PUNCH_OUT') && nv) {
    if (nv.isManual || nv.location === 'REMOTE') return 'hold';
  }
  
  if (a.includes('APPROV') || a.includes('LOGIN') || a.includes('PUNCH')) return 'info';
  if (a.includes('CREATE') || a.includes('ENROLL') || a.includes('PAID'))  return 'ok';
  if (a.includes('REVIEW') || a.includes('SUBMIT'))                        return 'hold';
  if (a.includes('REJECT') || a.includes('DELETE') || a.includes('POLICY')) return 'red';
  return 'mute';
}

function renderDetails(r: AuditLog): string | null {
  if (!r.newValue) return null;
  const nv = r.newValue;
  const actorName = r.actor ? `${r.actor.firstName} ${r.actor.lastName}`.toUpperCase() : 'EMPLOYEE';
  const dateStr = new Date(r.createdAt).toLocaleDateString('en-GB');

  if (r.action === 'PUNCH_IN') {
    if (nv.isManual) {
      const time = nv.time || '';
      const reason = nv.manualPunchReason || '';
      return `${actorName} USED MANUAL PUNCH-IN AT ${time} (FACE SERVICE BYPASSED). REASON: ${reason.toUpperCase()}`;
    }
    if (nv.isGeoValidIn === false || nv.location === 'REMOTE') {
      const gps = nv.latitude && nv.longitude ? ` GPS: ${Number(nv.latitude).toFixed(5)}, ${Number(nv.longitude).toFixed(5)}` : '';
      return `${actorName} PUNCHED IN FROM OUTSIDE THE OFFICE ON ${dateStr}.${gps}`;
    }
    const time = nv.time ? `at ${nv.time}` : '';
    return `${actorName} punched in ${time} from OFFICE (${nv.status})`;
  }
  
  if (r.action === 'PUNCH_OUT') {
    if (nv.isManual) {
      const time = nv.time || '';
      const reason = nv.manualPunchReason || '';
      return `${actorName} USED MANUAL PUNCH-OUT AT ${time} (FACE SERVICE BYPASSED). REASON: ${reason.toUpperCase()}`;
    }
    if (nv.isGeoValidOut === false || nv.location === 'REMOTE') {
      const gps = nv.latitude && nv.longitude ? ` GPS: ${Number(nv.latitude).toFixed(5)}, ${Number(nv.longitude).toFixed(5)}` : '';
      return `${actorName} PUNCHED OUT FROM OUTSIDE THE OFFICE ON ${dateStr}.${gps}`;
    }
    const time = nv.time ? `at ${nv.time}` : '';
    const hours = nv.workingHours != null ? ` Worked: ${nv.workingHours} hrs` : '';
    return `${actorName} punched out ${time} from OFFICE (${nv.status})${hours}`;
  }

  if (r.action === 'MISSING_PUNCH_OUT') {
    return nv.message || `Missing punch-out recorded.`;
  }
  
  if (r.action === 'REGULARIZE') {
    const status = nv.status ? `Status: ${nv.status}` : '';
    const hours = nv.workingHours != null ? ` Worked: ${nv.workingHours} hrs` : '';
    return `Regularized Attendance: ${status}${hours}`;
  }

  if (r.action === 'CREATE_EMPLOYEE') {
    return `Created employee with email: ${nv.email}, role: ${nv.role}`;
  }

  if (r.action === 'UPDATE_EMPLOYEE') {
    const oldVal = r.oldValue || {};
    const changes: string[] = [];
    if (oldVal.role !== nv.role) changes.push(`role: ${oldVal.role} → ${nv.role}`);
    if (oldVal.email !== nv.email) changes.push(`email: ${oldVal.email} → ${nv.email}`);
    return `Updated employee: ${changes.join(', ') || 'No critical changes'}`;
  }
  
  if (typeof nv === 'object' && nv !== null) {
    const keys = Object.keys(nv).filter(k => typeof nv[k] !== 'object' && nv[k] !== null);
    if (keys.length > 0) {
      return keys.map(k => `${k}: ${nv[k]}`).join(' | ');
    }
  }
  
  return null;
}

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? TONE_TAG.mute}`}>
      {children}
    </span>
  );
}

export default function AuditPage() {
  const [actorFilter, setActorFilter] = useState('ALL');

  const { data: response, isLoading } = useQuery<{ data: AuditLog[]; nextCursor: string | null }>({
    queryKey: ['audit-logs'],
    queryFn: () => apiClient.get('/audit-logs').then(r => r.data).catch(() => ({ data: [], nextCursor: null })),
  });
  const logs = response?.data ?? [];

  const actors = useMemo(() => {
    const names = logs.map(l => l.actor
      ? `${l.actor.firstName.toLowerCase()}.${l.actor.lastName[0]?.toLowerCase()}`
      : 'system'
    );
    return ['ALL', ...Array.from(new Set(names))];
  }, [logs]);

  const rows = useMemo(() => {
    if (actorFilter === 'ALL') return logs;
    return logs.filter(l => {
      const name = l.actor
        ? `${l.actor.firstName.toLowerCase()}.${l.actor.lastName[0]?.toLowerCase()}`
        : 'system';
      return name === actorFilter;
    });
  }, [actorFilter, logs]);

  function downloadCsv() {
    const header = 'TIMESTAMP,DATE,ACTOR,ACTION,TARGET,IP,AGENT';
    const csv = [header, ...rows.map(r => {
      const d = new Date(r.createdAt);
      const ts = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const dt = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).toUpperCase();
      const actor = r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : 'system';
      return `${ts},${dt},${actor},${r.action},${r.resourceType}/${r.resourceId},${r.ipAddress ?? '—'},${r.userAgent ?? '—'}`;
    })].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'audit-log.csv';
    a.click();
  }

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— AUDIT LOG / 10 · SUPER_ADMIN ONLY</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-ink text-brutal-yellow px-2">EVERY</span> ACTION<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            {isLoading ? '—' : rows.length} ENTRIES · 90 DAY RETENTION
          </div>
        </div>
        <button onClick={downloadCsv} className="brutal-btn-secondary px-5 py-3 text-[13px] flex items-center gap-2">
          <Download size={14} /> EXPORT CSV
        </button>
      </div>

      {/* Actor filter */}
      <div className="flex flex-wrap items-center gap-2">
        {actors.map(a => {
          const active = actorFilter === a;
          return (
            <button key={a} onClick={() => setActorFilter(a)}
              className={`font-display font-bold text-[11px] tracking-[0.16em] uppercase px-3 py-2 border-2 border-brutal-ink transition-colors
                ${active ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'}`}>
              {a}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="brutal-border diag bg-brutal-cream p-12 text-center">
          <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
            LOADING AUDIT LOG…
          </div>
        </div>
      ) : (
        <div className="brutal-border brutal-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[110px_90px_140px_1fr_180px_120px_120px] font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-ink text-brutal-cream">
                {['TIMESTAMP','DATE','ACTOR','ACTION · TARGET','RESOURCE','IP','AGENT'].map(h => (
                  <div key={h} className="px-3 py-2 border-r-[3px] border-brutal-cream/30 last:border-r-0">{h}</div>
                ))}
              </div>
              {rows.length === 0 && (
                <div className="px-6 py-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                  NO AUDIT RECORDS
                </div>
              )}
              {rows.map((r, i) => {
                const d     = new Date(r.createdAt);
                const ts    = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                const date  = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).toUpperCase();
                const actor = r.actor ? `${r.actor.firstName.toLowerCase()}.${r.actor.lastName[0]?.toLowerCase()}` : 'system';
                const tone  = actionTone(r);
                const ua    = r.userAgent
                  ? r.userAgent.includes('Mozilla') ? 'BROWSER' : r.userAgent.slice(0, 12).toUpperCase()
                  : 'CRON';
                return (
                  <div key={r.id}
                    className={`grid grid-cols-[110px_90px_140px_1fr_180px_120px_120px] items-center font-display font-bold text-[11px] tracking-[0.08em] ${i < rows.length - 1 ? 'brutal-border-b' : ''} hover:bg-brutal-surface transition-colors`}>
                    <div className="px-3 py-2.5 num border-r-[2px] border-brutal-ink/20">{ts}</div>
                    <div className="px-3 py-2.5 num border-r-[2px] border-brutal-ink/20">{date}</div>
                    <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20">{actor}</div>
                    <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20 flex flex-col justify-center gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Tag tone={tone}>{r.action.replace(/_/g, ' ')}</Tag>
                        <span className="text-brutal-ink/60 truncate text-[10px]">{r.resourceType}/{r.resourceId}</span>
                      </div>
                      {renderDetails(r) && (
                        <div className="text-[10px] text-brutal-ink font-body tracking-normal normal-case leading-normal bg-brutal-yellow/10 border border-brutal-ink/10 px-2 py-1 max-w-full break-words">
                          {renderDetails(r)}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20">
                      <span className="px-1.5 py-0.5 border-2 border-brutal-ink text-[10px] bg-brutal-surface">
                        {r.resourceType}
                      </span>
                    </div>
                    <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20 text-brutal-ink/60 text-[10px]">{r.ipAddress ?? '—'}</div>
                    <div className="px-3 py-2.5 text-brutal-ink/60 text-[10px] truncate">{ua}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
