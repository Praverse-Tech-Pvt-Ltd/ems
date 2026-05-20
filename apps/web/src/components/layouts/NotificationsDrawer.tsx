'use client';

import { useState } from 'react';
import { X, BellOff, CheckCheck } from 'lucide-react';
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
  if (t.includes('APPROV') || t.includes('PAID') || t.includes('SUCCESS') || t.includes('PUNCH_OUT') || t.includes('PUNCH_IN')) return 'ok';
  if (t.includes('PUNCH') || t.includes('SALARY') || t.includes('SLIP'))   return 'info';
  if (t.includes('LEAVE') || t.includes('REQUEST') || t.includes('PENDING')) return 'hold';
  if (t.includes('REJECT') || t.includes('POLICY') || t.includes('OVERDUE') || t.includes('REMOTE') || t.includes('OUTSIDE')) return 'red';
  return 'mute';
}

function deriveKind(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('EXPENSE') || t.includes('INVOICE')) return 'EXPNS';
  if (t.includes('PUNCH_OUT'))                         return 'OUT';
  if (t.includes('PUNCH') || t.includes('ATTEND'))     return 'PUNCH';
  if (t.includes('LEAVE'))                             return 'LEAVE';
  if (t.includes('POLICY') || t.includes('SYSTEM'))   return 'SYS';
  if (t.includes('SALARY') || t.includes('PAYROLL'))  return 'PAY';
  if (t.includes('REMOTE') || t.includes('OUTSIDE') || t.includes('GEO')) return 'GEO';
  return 'INFO';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface Props { open: boolean; onClose: () => void; }

export function NotificationsDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then(r => r.data).catch(() => []),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
    staleTime: 10_000,
  });

  // ── Mark one as read — optimistic update ────────────────────────────────
  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),

    // Immediately flip isRead in the cache before the request completes
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const previous = qc.getQueryData<Notification[]>(['notifications']);

      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.map(n => n.id === id ? { ...n, isRead: true } : n) ?? [],
      );

      // Also decrement the bell counter immediately
      qc.setQueryData<{ count: number }>(['notifications-unread'], old =>
        old ? { count: Math.max(0, old.count - 1) } : { count: 0 },
      );

      return { previous };
    },

    // Roll back on error
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['notifications'], ctx.previous);
      }
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },

    // Sync with server after success
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  // ── Mark all as read — optimistic update ────────────────────────────────
  const markAllMutation = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const previous = qc.getQueryData<Notification[]>(['notifications']);

      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.map(n => ({ ...n, isRead: true })) ?? [],
      );

      qc.setQueryData<{ count: number }>(['notifications-unread'], { count: 0 });

      return { previous };
    },

    onError: (_err, _void, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['notifications'], ctx.previous);
      }
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const unread    = notifications.filter(n => !n.isRead);
  const displayed = activeTab === 'unread' ? unread : notifications;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute top-0 right-0 h-full w-[420px] max-w-full bg-brutal-cream border-l-[4px] border-brutal-ink brutal-shadow-lg flex flex-col animate-fade-up">

        {/* Header */}
        <div className="px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">INBOX</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">NOTIFICATIONS</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-stretch brutal-border-b flex-shrink-0">
          <button
            onClick={() => setActiveTab('unread')}
            className={`flex-1 py-2.5 font-display font-bold text-[11px] tracking-[0.18em] brutal-border-r transition-colors ${
              activeTab === 'unread' ? 'bg-brutal-yellow text-brutal-ink' : 'hover:bg-brutal-surface text-brutal-ink/70'
            }`}
          >
            UNREAD · {unread.length}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2.5 font-display font-bold text-[11px] tracking-[0.18em] transition-colors ${
              activeTab === 'all' ? 'bg-brutal-yellow text-brutal-ink' : 'hover:bg-brutal-surface text-brutal-ink/70'
            }`}
          >
            ALL · {notifications.length}
          </button>
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto">
          {isLoading && (
            <li className="px-6 py-10 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
              LOADING…
            </li>
          )}
          {!isLoading && displayed.length === 0 && (
            <li className="flex flex-col items-center justify-center gap-3 py-16 text-brutal-ink/30">
              <BellOff size={32} />
              <span className="font-display font-bold text-[11px] tracking-[0.2em]">
                {activeTab === 'unread' ? 'ALL CAUGHT UP' : 'NO NOTIFICATIONS'}
              </span>
            </li>
          )}
          {displayed.map((n, idx) => {
            const tone = deriveTone(n.type, n.isRead);
            const kind = deriveKind(n.type);
            const isPending = markOneMutation.isPending && markOneMutation.variables === n.id;
            return (
              <li
                key={n.id}
                onClick={() => {
                  if (!n.isRead && !isPending) markOneMutation.mutate(n.id);
                }}
                className={`flex items-stretch ${
                  idx !== displayed.length - 1 ? 'brutal-border-b' : ''
                } ${
                  n.isRead
                    ? 'opacity-60 bg-brutal-surface cursor-default'
                    : 'bg-brutal-cream hover:bg-brutal-yellow/10 cursor-pointer'
                } transition-colors`}
              >
                <div className={`w-14 shrink-0 grid place-items-center brutal-border-r font-display font-bold text-[9px] tracking-[0.16em] ${TONE[tone] ?? TONE.mute}`}>
                  {isPending ? (
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : kind}
                </div>
                <div className="flex-1 px-4 py-3 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="font-display font-bold text-[13px] tracking-tight flex-1 leading-tight">{n.title}</div>
                    {!n.isRead && <span className="w-2 h-2 bg-brutal-red flex-shrink-0 mt-1" />}
                  </div>
                  <div className="font-display font-bold text-[10px] tracking-[0.12em] text-brutal-ink/60 mt-1 uppercase leading-relaxed line-clamp-2">{n.body}</div>
                  <div className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/40 mt-1.5">{fmtTime(n.createdAt)}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="p-3 brutal-border-t bg-brutal-surface flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unread.length === 0}
            className="flex-1 brutal-btn-secondary py-2 text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {markAllMutation.isPending
              ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> MARKING…</>
              : <><CheckCheck size={13} /> MARK ALL READ</>
            }
          </button>
          <button onClick={onClose} className="flex-1 brutal-btn-primary py-2 text-[11px]">
            CLOSE
          </button>
        </div>
      </aside>
    </div>
  );
}
