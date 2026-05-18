'use client';

import { X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@/types';

const TONE: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
  mute: 'bg-brutal-surface text-brutal-ink',
};

function deriveTone(type: string, isRead: boolean): string {
  if (isRead) return 'mute';
  const t = type.toUpperCase();
  if (t.includes('APPROV') || t.includes('PAID') || t.includes('SUCCESS')) return 'ok';
  if (t.includes('PUNCH') || t.includes('SALARY') || t.includes('SLIP'))   return 'info';
  if (t.includes('LEAVE') || t.includes('REQUEST') || t.includes('PENDING')) return 'hold';
  if (t.includes('REJECT') || t.includes('POLICY') || t.includes('OVERDUE')) return 'red';
  return 'mute';
}

function deriveKind(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('EXPENSE') || t.includes('INVOICE')) return 'EXPNS';
  if (t.includes('PUNCH') || t.includes('ATTEND'))    return 'PUNCH';
  if (t.includes('LEAVE'))                             return 'LEAVE';
  if (t.includes('POLICY') || t.includes('SYSTEM'))   return 'SYS';
  if (t.includes('SALARY') || t.includes('PAYROLL'))  return 'PAY';
  return 'INFO';
}

interface Props { open: boolean; onClose: () => void; }

export function NotificationsDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then(r => r.data).catch(() => []),
    enabled: open,
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'notifications-unread'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'notifications-unread'] }),
  });

  const unread = notifications.filter(n => !n.isRead);

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
            UNREAD · {unread.length}
          </button>
          <button className="flex-1 py-2.5 font-display font-bold text-[11px] tracking-[0.18em] hover:bg-brutal-surface transition-colors">
            ALL · {notifications.length}
          </button>
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <li className="px-6 py-10 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
              NO NOTIFICATIONS
            </li>
          )}
          {notifications.map((n, idx) => {
            const tone = deriveTone(n.type, n.isRead);
            const kind = deriveKind(n.type);
            const time = new Date(n.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            return (
              <li
                key={n.id}
                onClick={() => !n.isRead && markOneMutation.mutate(n.id)}
                className={`flex items-stretch cursor-pointer ${idx !== notifications.length - 1 ? 'brutal-border-b' : ''} ${n.isRead ? 'bg-brutal-surface' : 'bg-brutal-cream'}`}
              >
                <div className={`w-14 shrink-0 grid place-items-center brutal-border-r font-display font-bold text-[9px] tracking-[0.16em] ${TONE[tone] ?? TONE.mute}`}>
                  {kind}
                </div>
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="font-display font-bold text-[13px] tracking-tight flex-1">{n.title}</div>
                    {!n.isRead && <span className="w-2 h-2 bg-brutal-red mt-1.5 flex-shrink-0" />}
                  </div>
                  <div className="font-display font-bold text-[10px] tracking-[0.12em] text-brutal-ink/60 mt-1 uppercase">{n.body}</div>
                  <div className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/50 mt-1">{time}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="p-3 brutal-border-t bg-brutal-surface flex items-center gap-2">
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unread.length === 0}
            className="flex-1 brutal-btn-secondary py-2 text-[11px] disabled:opacity-50"
          >
            MARK ALL READ
          </button>
          <button className="flex-1 brutal-btn-primary py-2 text-[11px]">SETTINGS</button>
        </div>
      </aside>
    </div>
  );
}
