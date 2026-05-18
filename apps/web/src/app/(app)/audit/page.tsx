'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';

const AUDIT = [
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

const TONE_TAG: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? TONE_TAG.mute}`}>
      {children}
    </span>
  );
}

export default function AuditPage() {
  const [actor, setActor] = useState('ALL');
  const actors = useMemo(() => ['ALL', ...new Set(AUDIT.map(a => a.actor))], []);
  const rows = useMemo(() => actor === 'ALL' ? AUDIT : AUDIT.filter(r => r.actor === actor), [actor]);

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— AUDIT LOG / 10 · SUPER_ADMIN ONLY</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            <span className="inline-block bg-brutal-ink text-brutal-yellow px-2">EVERY</span> ACTION<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            {AUDIT.length} OF 23,418 ENTRIES · 90 DAY RETENTION
          </div>
        </div>
        <button className="brutal-btn-secondary px-5 py-3 text-[13px] flex items-center gap-2">
          <Download size={14} /> EXPORT CSV
        </button>
      </div>

      {/* Actor filter */}
      <div className="flex flex-wrap items-center gap-2">
        {actors.map(a => {
          const active = actor === a;
          return (
            <button key={a} onClick={() => setActor(a)}
              className={`font-display font-bold text-[11px] tracking-[0.16em] uppercase px-3 py-2 border-2 border-brutal-ink transition-colors
                ${active ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'}`}>
              {a}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="brutal-border brutal-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[110px_90px_140px_1fr_180px_120px_120px] font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-ink text-brutal-cream">
              {['TIMESTAMP','DATE','ACTOR','ACTION · TARGET','ROLE','IP','AGENT'].map(h => (
                <div key={h} className="px-3 py-2 border-r-[3px] border-brutal-cream/30 last:border-r-0">{h}</div>
              ))}
            </div>
            {rows.map((r, i) => (
              <div key={i}
                className={`grid grid-cols-[110px_90px_140px_1fr_180px_120px_120px] items-center font-display font-bold text-[11px] tracking-[0.08em] ${i < rows.length - 1 ? 'brutal-border-b' : ''} hover:bg-brutal-surface transition-colors`}>
                <div className="px-3 py-2.5 num border-r-[2px] border-brutal-ink/20">{r.ts}</div>
                <div className="px-3 py-2.5 num border-r-[2px] border-brutal-ink/20">{r.date}</div>
                <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20">{r.actor}</div>
                <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20 flex items-center gap-2 min-w-0">
                  <Tag tone={r.tone}>{r.action}</Tag>
                  <span className="text-brutal-ink/60 truncate text-[10px]">{r.target}</span>
                </div>
                <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20">
                  <span className={`px-1.5 py-0.5 border-2 border-brutal-ink text-[10px]
                    ${r.role === 'SUPER_ADMIN' ? 'bg-brutal-red text-white' :
                      r.role === 'ADMIN'       ? 'bg-brutal-yellow' :
                      r.role === 'MANAGER'     ? 'bg-brutal-blue text-white' :
                      'bg-brutal-surface'}`}>
                    {r.role}
                  </span>
                </div>
                <div className="px-3 py-2.5 border-r-[2px] border-brutal-ink/20 text-brutal-ink/60 text-[10px]">{r.ip}</div>
                <div className="px-3 py-2.5 text-brutal-ink/60 text-[10px] truncate">{r.ua}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
