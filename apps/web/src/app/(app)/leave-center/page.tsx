'use client';

import { useState, useEffect } from 'react';
import { leavesService } from '@/lib/api/leaves';
import { useAuthStore } from '@/store/auth.store';
import type { LeaveBalance, LeaveRequest } from '@/types';

const LEAVE_LABEL: Record<string, string> = {
  CL: 'Casual Leave', SL: 'Sick Leave', PL: 'Privilege Leave', UL: 'Unpaid Leave', CO: 'Comp Off',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-primary/10 text-primary border-primary/20',
  APPROVED: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  REJECTED: 'bg-error/10 text-error border-error/20',
  CANCELLED: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
};
const BALANCE_COLORS = ['bg-primary', 'bg-tertiary', 'bg-error', 'bg-secondary-container'];

export default function LeaveCenterPage() {
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
        leavesService.balance().catch(() => []),
        leavesService.my().catch(() => []),
      ]);
      setBalances(Array.isArray(bal) ? bal : []);
      setMyLeaves(Array.isArray(mine) ? mine : mine?.data ?? []);

      if (isAdmin) {
        const all = await leavesService.all({ status: 'PENDING' }).catch(() => []);
        setPendingLeaves(Array.isArray(all) ? all : all?.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
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

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">event_available</span>
          LEAVE CENTER
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Leave Center</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Leave Center</h2>
            <p className="text-on-surface-variant mt-xs">Manage leave balances, apply for leave, and track approvals.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 shrink-0">
            <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'Apply Leave'}
          </button>
        </div>
      </div>

      {/* Apply leave form */}
      {showForm && (
        <div className="glass-card rounded-2xl p-lg border border-primary/30">
          <p className="font-label-caps text-label-caps text-primary tracking-widest mb-md">NEW LEAVE REQUEST</p>
          {msg.text && (
            <div className={`mb-sm text-sm font-semibold px-4 py-2 rounded-full ${msg.ok ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-sm">
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">LEAVE TYPE</label>
              <select value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none">
                {Object.entries(LEAVE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">FROM DATE</label>
              <input type="date" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">TO DATE</label>
              <input type="date" value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">REASON</label>
              <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Brief reason..."
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="mt-md bg-primary text-on-primary font-label-caps text-label-caps px-lg py-2 rounded-full hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      )}

      {/* Leave balances */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">LEAVE BALANCES — {new Date().getFullYear()}</p>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-surface-container-high animate-pulse" />)}
          </div>
        ) : balances.length === 0 ? (
          <div className="glass-card rounded-2xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
            No leave balance data for this year.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {balances.map((b, i) => {
              const pct = b.totalDays > 0 ? (b.usedDays / b.totalDays) * 100 : 0;
              return (
                <div key={b.leaveType} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex flex-col gap-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-on-surface text-sm">{LEAVE_LABEL[b.leaveType] ?? b.leaveType}</p>
                      <p className="text-[10px] text-on-surface-variant">{b.leaveType}</p>
                    </div>
                    <span className="font-black text-2xl text-on-surface">{b.totalDays - b.usedDays}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className={`h-full rounded-full ${BALANCE_COLORS[i % BALANCE_COLORS.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-on-surface-variant">{b.usedDays} used · {b.totalDays} total</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My requests */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">MY LEAVE REQUESTS</p>
        {loading ? (
          <div className="flex flex-col gap-xs">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
          </div>
        ) : myLeaves.length === 0 ? (
          <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
            No leave requests yet.
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="divide-y divide-outline-variant/20">
              {myLeaves.map(req => (
                <div key={req.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="font-bold text-xs">{req.leaveType}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{LEAVE_LABEL[req.leaveType] ?? req.leaveType}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {new Date(req.fromDate).toLocaleDateString('en-IN')} → {new Date(req.toDate).toLocaleDateString('en-IN')} · {req.totalDays} day(s)
                    </p>
                  </div>
                  <p className="text-body-sm text-on-surface-variant hidden md:block max-w-[180px] truncate">{req.reason}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[req.status]}`}>{req.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin: pending approvals */}
      {isAdmin && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">
            PENDING APPROVALS
            {pendingLeaves.length > 0 && (
              <span className="ml-sm bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingLeaves.length}</span>
            )}
          </p>
          {loading ? (
            <div className="flex flex-col gap-xs">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
              No pending leave requests.
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
              <div className="divide-y divide-outline-variant/20">
                {pendingLeaves.map(req => (
                  <div key={req.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors flex-wrap">
                    <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                      {req.employee?.firstName?.[0]}{req.employee?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-sm">{req.employee?.firstName} {req.employee?.lastName}</p>
                      <p className="text-body-sm text-on-surface-variant">
                        {LEAVE_LABEL[req.leaveType] ?? req.leaveType} · {new Date(req.fromDate).toLocaleDateString('en-IN')} → {new Date(req.toDate).toLocaleDateString('en-IN')} · {req.totalDays}d
                      </p>
                    </div>
                    <p className="text-body-sm text-on-surface-variant hidden lg:block max-w-[160px] truncate">{req.reason}</p>
                    <div className="flex gap-xs shrink-0">
                      <button onClick={() => handleAction(req.id, 'APPROVE')} disabled={actionLoading === req.id + 'APPROVE'}
                        className="bg-tertiary/10 text-tertiary border border-tertiary/20 font-label-caps text-[10px] px-3 py-1.5 rounded-full hover:bg-tertiary/20 transition-colors disabled:opacity-50">
                        {actionLoading === req.id + 'APPROVE' ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => handleAction(req.id, 'REJECT')} disabled={actionLoading === req.id + 'REJECT'}
                        className="bg-error/10 text-error border border-error/20 font-label-caps text-[10px] px-3 py-1.5 rounded-full hover:bg-error/20 transition-colors disabled:opacity-50">
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
