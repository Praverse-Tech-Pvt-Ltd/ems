'use client';

import { useState } from 'react';
import { X, BellOff, CheckCheck, Megaphone, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import type { Notification } from '@/types';

// Notification type → dot color class
function deriveDotColor(type: string, isRead: boolean): string {
  if (isRead) return 'bg-surface-container-high';
  const t = type.toUpperCase();
  if (t.includes('APPROV') || t.includes('PAID') || t.includes('SUCCESS') || t.includes('PUNCH'))
    return 'bg-success-emerald';
  if (t.includes('LEAVE') || t.includes('REQUEST') || t.includes('PENDING') || t.includes('SALARY'))
    return 'bg-secondary';
  if (t.includes('REJECT') || t.includes('OVERDUE') || t.includes('OUTSIDE') || t.includes('GEO'))
    return 'bg-error';
  return 'bg-tertiary-container';
}

// Notification type → category label
function deriveCategory(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('EXPENSE') || t.includes('INVOICE')) return 'Finance';
  if (t.includes('PUNCH') || t.includes('ATTEND'))   return 'Attendance';
  if (t.includes('LEAVE'))                            return 'Leave';
  if (t.includes('SALARY') || t.includes('PAYROLL')) return 'Payroll';
  if (t.includes('POLICY') || t.includes('SYSTEM'))  return 'System';
  if (t.includes('GEO') || t.includes('REMOTE'))     return 'Location';
  return 'Info';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
}

interface Props { open: boolean; onClose: () => void; }

export function NotificationsDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [activeTab, setActiveTab]           = useState<'unread' | 'all'>('unread');
  const [showBroadcast, setShowBroadcast]   = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: (data: { title: string; message: string }) =>
      apiClient.post('/notifications/broadcast', data).then(r => r.data),
    onSuccess: (data) => {
      setBroadcastTitle('');
      setBroadcastMessage('');
      setShowBroadcast(false);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      alert(`Announcement sent to ${data.sent} team member${data.sent !== 1 ? 's' : ''}.`);
    },
  });

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then(r => r.data).catch(() => []),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
    staleTime: 10_000,
  });

  // Mark one read — optimistic
  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const previous = qc.getQueryData<Notification[]>(['notifications']);
      qc.setQueryData<Notification[]>(['notifications'], old =>
        old?.map(n => n.id === id ? { ...n, isRead: true } : n) ?? [],
      );
      qc.setQueryData<{ count: number }>(['notifications-unread'], old =>
        old ? { count: Math.max(0, old.count - 1) } : { count: 0 },
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(['notifications'], ctx.previous);
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  // Mark all read — optimistic
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
      if (ctx?.previous) qc.setQueryData(['notifications'], ctx.previous);
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="absolute top-0 right-0 h-full w-[400px] max-w-full bg-surface-container-lowest border-l border-outline-variant shadow-xl flex flex-col animate-slide-in-right">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-on-surface">Notifications</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {unread.length} unread
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                onClick={() => setShowBroadcast(v => !v)}
                title="Broadcast to all staff"
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  showBroadcast
                    ? 'bg-primary-fixed text-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <Megaphone size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Broadcast panel ─────────────────────────────────────────── */}
        {isAdmin && showBroadcast && (
          <div className="px-5 py-4 bg-surface-container-low border-b border-outline-variant flex-shrink-0">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              Broadcast to all staff
            </p>
            <input
              type="text"
              placeholder="Announcement title…"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/40 mb-2 transition-all"
            />
            <textarea
              placeholder="Write your message here…"
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              rows={3}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/40 resize-none mb-3 transition-all"
            />
            <button
              onClick={() => {
                if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
                broadcastMutation.mutate({ title: broadcastTitle.trim(), message: broadcastMessage.trim() });
              }}
              disabled={broadcastMutation.isPending || !broadcastTitle.trim() || !broadcastMessage.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-full bg-primary-container text-on-primary text-sm font-semibold shadow-sm hover:bg-primary transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {broadcastMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Sending…</>
                : <><Send size={13} /> Send to all staff</>
              }
            </button>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 px-5 pt-3 pb-0 flex-shrink-0">
          {(['unread', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-primary-fixed text-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {tab === 'unread' ? `Unread (${unread.length})` : `All (${notifications.length})`}
            </button>
          ))}
        </div>

        {/* ── List ────────────────────────────────────────────────────── */}
        <ul className="flex-1 overflow-y-auto py-2 px-3">
          {isLoading && (
            <li className="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
              <span className="w-5 h-5 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
              Loading…
            </li>
          )}
          {!isLoading && displayed.length === 0 && (
            <li className="flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant/40">
              <BellOff size={32} />
              <span className="text-sm font-medium">
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
              </span>
            </li>
          )}
          {displayed.map(n => {
            const dotColor  = deriveDotColor(n.type, n.isRead);
            const category  = deriveCategory(n.type);
            const isPending = markOneMutation.isPending && markOneMutation.variables === n.id;

            return (
              <li
                key={n.id}
                onClick={() => {
                  if (!n.isRead && !isPending) markOneMutation.mutate(n.id);
                }}
                className={`flex items-start gap-3 p-3 rounded-xl mb-1 transition-colors ${
                  n.isRead
                    ? 'opacity-60 cursor-default'
                    : 'hover:bg-surface-container-low cursor-pointer'
                }`}
              >
                {/* Colored dot */}
                <div className="mt-1 flex-shrink-0 relative">
                  <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                  {!n.isRead && (
                    <div className={`absolute inset-0 rounded-full ${dotColor} animate-pulse-soft`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-on-surface leading-tight">{n.title}</p>
                    {isPending && (
                      <span className="w-3 h-3 border-2 border-primary-container border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-semibold text-on-surface-variant/60 bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant/60">
                      {category}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/50">
                      {fmtTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-outline-variant flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || unread.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {markAllMutation.isPending
              ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Marking…</>
              : <><CheckCheck size={14} /> Mark all read</>
            }
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center py-2 rounded-full bg-primary-container text-on-primary text-sm font-semibold shadow-sm hover:bg-primary transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
