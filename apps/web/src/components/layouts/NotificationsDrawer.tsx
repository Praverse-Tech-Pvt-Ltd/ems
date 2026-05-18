'use client';

import { X } from 'lucide-react';

const NOTIFICATIONS = [
  { id: 'N-188', kind: 'EXPENSE',  unread: true,  title: 'INV-092 approved by Finance',          meta: 'Cleared · disbursement in 24h',       time: '08:14', tone: 'ok'   },
  { id: 'N-187', kind: 'PUNCH',    unread: true,  title: 'Face punch-in successful',             meta: 'Tower B · 09:00 IST · liveness OK',   time: '09:00', tone: 'info' },
  { id: 'N-186', kind: 'LEAVE',    unread: true,  title: 'L. Park requested decision on LV-041', meta: 'Sick leave · 17 May',                  time: '07:42', tone: 'hold' },
  { id: 'N-184', kind: 'POLICY',   unread: false, title: "Travel cap revised — Memo 14-B",       meta: 'Effective 20 May · review required',   time: 'Y\'DAY', tone: 'red'  },
  { id: 'N-181', kind: 'SALARY',   unread: false, title: 'April salary slip available',          meta: '₹ 1,58,320 net · UPI · HDFC',          time: '01 MAY', tone: 'mute' },
  { id: 'N-176', kind: 'COMMENT',  unread: false, title: 'P. Saxena commented on INV-094',       meta: '"Need GST breakdown"',                 time: '13 MAY', tone: 'mute' },
];

const TONE: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

interface Props { open: boolean; onClose: () => void; }

export function NotificationsDrawer({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute top-0 right-0 h-full w-[420px] max-w-full bg-brutal-cream border-l-[4px] border-brutal-ink brutal-shadow-lg flex flex-col animate-fade-up">
        {/* Header */}
        <div className="px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">INBOX</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">NOTIFICATIONS</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-stretch brutal-border-b">
          <button className="flex-1 py-2.5 bg-brutal-yellow font-display font-bold text-[11px] tracking-[0.18em] brutal-border-r">
            UNREAD · {NOTIFICATIONS.filter(n => n.unread).length}
          </button>
          <button className="flex-1 py-2.5 font-display font-bold text-[11px] tracking-[0.18em] hover:bg-brutal-surface transition-colors">
            ALL · {NOTIFICATIONS.length}
          </button>
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto">
          {NOTIFICATIONS.map((n, idx) => (
            <li
              key={n.id}
              className={`flex items-stretch ${idx !== NOTIFICATIONS.length - 1 ? 'brutal-border-b' : ''} ${n.unread ? 'bg-brutal-cream' : 'bg-brutal-surface'}`}
            >
              <div className={`w-14 shrink-0 grid place-items-center brutal-border-r font-display font-bold text-[9px] tracking-[0.16em] ${TONE[n.tone] ?? TONE.mute}`}>
                {n.kind}
              </div>
              <div className="flex-1 px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="font-display font-bold text-[13px] tracking-tight flex-1">{n.title}</div>
                  {n.unread && <span className="w-2 h-2 bg-brutal-red mt-1.5 flex-shrink-0" />}
                </div>
                <div className="font-display font-bold text-[10px] tracking-[0.12em] text-brutal-ink/60 mt-1 uppercase">{n.meta}</div>
                <div className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/50 mt-1">{n.id} · {n.time}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="p-3 brutal-border-t bg-brutal-surface flex items-center gap-2">
          <button className="flex-1 brutal-btn-secondary py-2 text-[11px]">MARK ALL READ</button>
          <button className="flex-1 brutal-btn-primary py-2 text-[11px]">SETTINGS</button>
        </div>
      </aside>
    </div>
  );
}
