'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const MOCK_LOGS = [
  { ts: '09:00:14', date: '15 MAY', actor: 'aarav.m',  role: 'EMPLOYEE',    action: 'PUNCH_IN',        target: 'attendance/15-MAY', ip: '10.4.2.18', ua: 'CHROME / MAC',  tone: 'info' },
  { ts: '08:14:02', date: '15 MAY', actor: 'p.saxena', role: 'ADMIN',       action: 'EXPENSE_APPROVE', target: 'expense/INV-092',   ip: '10.4.2.31', ua: 'CHROME / WIN',  tone: 'ok'   },
  { ts: '07:42:55', date: '15 MAY', actor: 'l.park',   role: 'MANAGER',     action: 'LEAVE_REVIEW',    target: 'leave/LV-041',      ip: '10.4.2.07', ua: 'SAFARI / MAC',  tone: 'hold' },
  { ts: '23:18:09', date: '14 MAY', actor: 'system',   role: 'SUPER_ADMIN', action: 'POLICY_UPDATE',   target: 'policy/14-B',       ip: '—',         ua: 'CRON',          tone: 'red'  },
  { ts: '18:42:31', date: '14 MAY', actor: 'aarav.m',  role: 'EMPLOYEE',    action: 'PUNCH_OUT',       target: 'attendance/14-MAY', ip: '10.4.2.18', ua: 'CHROME / MAC',  tone: 'mute' },
  { ts: '16:02:18', date: '14 MAY', actor: 'd.iyer',   role: 'MANAGER',     action: 'REQUEST_REJECT',  target: 'request/REQ-039',   ip: '10.4.2.44', ua: 'FIREFOX / WIN', tone: 'red'  },
  { ts: '11:38:00', date: '14 MAY', actor: 'aarav.m',  role: 'EMPLOYEE',    action: 'FACE_ENROLL',     target: 'employees/0421',    ip: '10.4.2.18', ua: 'CHROME / MAC',  tone: 'info' },
  { ts: '09:01:42', date: '14 MAY', actor: 'p.saxena', role: 'ADMIN',       action: 'INVOICE_CREATE',  target: 'invoice/VINV-3091', ip: '10.4.2.31', ua: 'CHROME / WIN',  tone: 'mute' },
  { ts: '17:55:12', date: '13 MAY', actor: 'aarav.m',  role: 'EMPLOYEE',    action: 'LOGIN_2FA',       target: 'session/0x9a4',     ip: '10.4.2.18', ua: 'CHROME / MAC',  tone: 'mute' },
];

const ROLE_STYLE: Record<string, string> = {
  EMPLOYEE:    'bg-brutal-surface text-brutal-ink',
  MANAGER:     'bg-brutal-blue text-white',
  ADMIN:       'bg-brutal-yellow text-brutal-ink',
  SUPER_ADMIN: 'bg-brutal-red text-white',
};

const TONE_STYLE: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

const ALL_ACTORS = ['ALL', ...Array.from(new Set(MOCK_LOGS.map((l) => l.actor)))];

export default function AuditPage() {
  const [actor, setActor] = useState('ALL');

  const filtered = actor === 'ALL' ? MOCK_LOGS : MOCK_LOGS.filter((l) => l.actor === actor);

  return (
    <div className="space-y-8 max-w-6xl animate-fade-up">
      {/* Header */}
      <div>
        <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— AUDIT LOG / 10</div>
        <h1 className="mt-2 font-display font-bold text-[44px] leading-[1.1] tracking-tight text-brutal-ink">
          AUDIT <span className="inline-block bg-brutal-ink text-brutal-yellow px-2">TRAIL</span>
          <span className="text-brutal-red">.</span>
        </h1>
        <div className="mt-2 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 flex items-center gap-2">
          <ShieldCheck size={12} /> {MOCK_LOGS.length} EVENTS · LAST 3 DAYS
        </div>
      </div>

      {/* Actor filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_ACTORS.map((a) => (
          <button
            key={a}
            onClick={() => setActor(a)}
            className={`font-display font-bold text-[11px] tracking-[0.16em] px-3 py-2 border-2 border-brutal-ink transition-colors ${
              actor === a ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="brutal-border brutal-shadow bg-brutal-cream overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-brutal-ink text-brutal-cream brutal-border-b">
              {['TIMESTAMP', 'ACTOR', 'ROLE', 'ACTION', 'TARGET', 'IP', 'CLIENT'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-display font-bold text-[10px] tracking-[0.2em]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => (
              <tr key={i} className={`brutal-border-b ${i % 2 !== 0 ? 'bg-brutal-surface-lo' : ''} hover:bg-brutal-surface transition-colors`}>
                <td className="px-4 py-3 font-display font-bold text-[11px] whitespace-nowrap">
                  <span className="text-brutal-ink/50 mr-2">{log.date}</span>{log.ts}
                </td>
                <td className="px-4 py-3 font-display font-bold text-[12px]">{log.actor}</td>
                <td className="px-4 py-3">
                  <span className={`font-display font-bold text-[10px] tracking-[0.14em] px-2 py-0.5 border-2 border-brutal-ink ${ROLE_STYLE[log.role] ?? ''}`}>
                    {log.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-display font-bold text-[10px] tracking-[0.14em] px-2 py-0.5 border-2 border-brutal-ink ${TONE_STYLE[log.tone] ?? ''}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-body text-[11px] text-brutal-ink/70 max-w-[160px] truncate">{log.target}</td>
                <td className="px-4 py-3 font-display font-bold text-[11px] text-brutal-ink/70">{log.ip}</td>
                <td className="px-4 py-3 font-display font-bold text-[11px] text-brutal-ink/70">{log.ua}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
