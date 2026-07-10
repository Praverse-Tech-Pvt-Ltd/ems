'use client';

import { useState, useEffect } from 'react';
import { leavesService } from '@/lib/api/leaves';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import type { LeaveBalance, LeaveRequest } from '@/types';

const LEAVE_LABEL: Record<string, string> = {
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  PL: 'Paid Leave',
  UL: 'Unpaid Leave',
  CO: 'On Duty (OD)',
};

const DEFAULT_COLOR = { text: 'text-tertiary', bg: 'bg-tertiary/10', border: 'border-tertiary/20', dot: 'bg-tertiary' };

const colorMap: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  PL: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', dot: 'bg-primary' },
  CL: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20', dot: 'bg-success' },
  SL: { text: 'text-error', bg: 'bg-error/10', border: 'border-error/20', dot: 'bg-error' },
  UL: { text: 'text-on-surface-variant', bg: 'bg-on-surface-variant/10', border: 'border-on-surface-variant/20', dot: 'bg-on-surface-variant' },
};

function LeaveLimitCard({ title, label, used, max, colorKey, isUnlimited }: {
  title: string;
  label: string;
  used: number;
  max: number;
  colorKey: string;
  isUnlimited: boolean;
}) {
  const colors = colorMap[colorKey] ?? DEFAULT_COLOR;
  const pct = !isUnlimited && max > 0 ? (used / max) * 100 : 0;

  return (
    <div className="bg-card border border-card-border rounded-3xl p-5 shadow-sm flex items-center justify-between card-hover">
      <div className="flex flex-col">
        <span className="font-extrabold text-xs text-on-surface leading-tight">{title}</span>
        <span className="text-[10px] text-on-surface-variant font-semibold mt-1">
          {isUnlimited ? `Leaves Used: ${used} / ∞` : `Leaves Used: ${used} / ${max} Days`}
        </span>
      </div>
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-full h-full" viewBox="0 0 36 36">
          <path className="text-surface-container-highest" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          {!isUnlimited && (
            <path
              className={colors.text}
              strokeWidth="3"
              strokeDasharray={`${pct}, 100`}
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono text-on-surface">
          {isUnlimited ? '∞' : `${Math.round(pct)}%`}
        </div>
      </div>
    </div>
  );
}

export default function LeaveCenterPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: 'CL', fromDate: '', toDate: '', reason: '' });
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [bal, mine] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ['leaves-balance', user?.id], queryFn: () => leavesService.balance() }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['leaves-my', user?.id], queryFn: () => leavesService.my() }).catch(() => []),
      ]);
      setBalances(Array.isArray(bal) ? bal : []);
      setMyLeaves(Array.isArray(mine) ? mine : mine?.data ?? []);

      if (isAdmin) {
        const all = await queryClient.fetchQuery({ queryKey: ['leaves-all-pending'], queryFn: () => leavesService.all({ status: 'PENDING' }) }).catch(() => []);
        setPendingLeaves(Array.isArray(all) ? all : all?.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromDate || !form.toDate || !form.reason) {
      setMsg({ text: 'Please fill all fields', ok: false });
      return;
    }
    setSubmitting(true);
    try {
      await leavesService.apply(form);
      setMsg({ text: 'Leave applied successfully!', ok: true });
      setShowForm(false);
      setForm({ leaveType: 'CL', fromDate: '', toDate: '', reason: '' });
      await load();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message ?? 'Failed to apply leave', ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActionLoading(id + action);
    try {
      await leavesService.approve(id, action);
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const getStatusStyle = (status: string): { badge: string; dot: string } => {
    if (status === 'APPROVED') return { badge: 'bg-success/10 text-success border-success/20', dot: 'bg-success' };
    if (status === 'PENDING')  return { badge: 'bg-tertiary/10 text-tertiary border-tertiary/20', dot: 'bg-tertiary' };
    if (status === 'REJECTED') return { badge: 'bg-error/10 text-error border-error/20', dot: 'bg-error' };
    return { badge: 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20', dot: 'bg-on-surface-variant' };
  };

  return (
    <div className="flex flex-col gap-lg animate-fade-in">
      {/* Header */}
      <div className="border-b border-card-border pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs font-bold">
          <span className="material-symbols-outlined text-[18px]">event_available</span>
          LEAVE CENTER
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Leave Management Center</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Leave Center</h2>
            <p className="text-on-surface-variant mt-xs text-sm">Apply for paid, sick, or casual leaves and track balance configurations.</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setMsg({ text: '', ok: true }); }}
            className="flex min-h-11 items-center gap-xs text-xs font-bold bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Apply Leave
          </button>
        </div>
      </div>

      {/* Apply Leave Modal Overlay */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card border border-card-border rounded-3xl w-full max-w-md p-6 relative overflow-hidden transition-all shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-card-border mb-4">
              <span className="font-extrabold text-base text-on-surface">Submit Leave Request</span>
              <button
                onClick={() => setShowForm(false)}
                className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors"
              >
                close
              </button>
            </div>

            {msg.text && (
              <div className={`mb-4 text-xs font-bold px-4 py-2.5 rounded-xl border ${msg.ok ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Leave Type</label>
                <select
                  value={form.leaveType}
                  onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-card-border bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary"
                >
                  {Object.entries(LEAVE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    required
                    type="date"
                    value={form.fromDate}
                    onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-card-border bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">End Date</label>
                  <input
                    required
                    type="date"
                    value={form.toDate}
                    onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-card-border bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the leave context..."
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-4 py-2 border border-card-border bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-2xl font-bold text-sm tracking-tight bg-primary hover:bg-primary/90 text-on-primary shadow-lg shadow-primary/15 transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Leave balances */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm font-bold">LEAVE BALANCES — {new Date().getFullYear()}</p>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-3xl bg-surface-container-highest animate-pulse" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant text-sm">
            No leave balance data for this year.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {balances.map(b => (
              <LeaveLimitCard
                key={b.leaveType}
                title={LEAVE_LABEL[b.leaveType] ?? b.leaveType}
                label={b.leaveType}
                used={b.usedDays}
                max={b.totalDays}
                colorKey={b.leaveType}
                isUnlimited={b.leaveType === 'UL'}
              />
            ))}
          </div>
        )}
      </div>

      {/* My requests */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm font-bold">MY LEAVE REQUESTS TIMELINE</p>
        {loading ? (
          <div className="flex flex-col gap-sm">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-3xl bg-surface-container-highest animate-pulse" />
            ))}
          </div>
        ) : myLeaves.length === 0 ? (
          <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant text-sm">
            No leave requests yet.
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y divide-card-border">
              {myLeaves.map(req => {
                const colors = colorMap[req.leaveType] ?? DEFAULT_COLOR;
                const style = getStatusStyle(req.status);
                return (
                  <div key={req.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                        <span className={`material-symbols-outlined ${colors.text}`}>flight_takeoff</span>
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-bold text-sm text-on-surface">
                          {LEAVE_LABEL[req.leaveType] ?? req.leaveType} Request — {req.totalDays} {req.totalDays === 1 ? 'Day' : 'Days'}
                        </h3>
                        <span className="text-xs text-on-surface-variant mt-0.5">
                          {new Date(req.fromDate).toLocaleDateString('en-IN')} to {new Date(req.toDate).toLocaleDateString('en-IN')} | Reason: "{req.reason}"
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${style.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                        {req.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Admin: pending approvals */}
      {isAdmin && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm font-bold">
            PENDING APPROVALS REQUESTS QUEUE
            {pendingLeaves.length > 0 && (
              <span className="ml-sm bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingLeaves.length}</span>
            )}
          </p>
          {loading ? (
            <div className="flex flex-col gap-sm">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-3xl bg-surface-container-highest animate-pulse" />
              ))}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <div className="bg-card border border-card-border rounded-3xl p-lg text-center text-on-surface-variant text-sm">
              No pending leave requests.
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
              <div className="divide-y divide-card-border">
                {pendingLeaves.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold text-xs shrink-0 border border-card-border">
                        {req.employee?.firstName?.[0] || 'E'}{req.employee?.lastName?.[0] || 'M'}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-bold text-sm text-on-surface">{req.employee?.firstName} {req.employee?.lastName}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {LEAVE_LABEL[req.leaveType] ?? req.leaveType} · {new Date(req.fromDate).toLocaleDateString('en-IN')} to {new Date(req.toDate).toLocaleDateString('en-IN')} · {req.totalDays}d
                        </p>
                        <p className="text-xs italic text-on-surface-variant mt-1">Reason: "{req.reason}"</p>
                      </div>
                    </div>

                    <div className="flex gap-xs shrink-0">
                      <button
                        onClick={() => handleAction(req.id, 'APPROVE')}
                        disabled={actionLoading === req.id + 'APPROVE'}
                        className="bg-success/10 hover:bg-success/20 text-success border border-success/20 font-bold text-xs px-4 py-2 rounded-full transition-colors disabled:opacity-50"
                      >
                        {actionLoading === req.id + 'APPROVE' ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'REJECT')}
                        disabled={actionLoading === req.id + 'REJECT'}
                        className="bg-error/10 hover:bg-error/20 text-error border border-error/20 font-bold text-xs px-4 py-2 rounded-full transition-colors disabled:opacity-50"
                      >
                        {actionLoading === req.id + 'REJECT' ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
