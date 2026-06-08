'use client';

import { useState, useEffect } from 'react';
import { expensesService } from '@/lib/api/expenses';
import { useAuthStore } from '@/store/auth.store';
import type { Expense } from '@/types';

const CATEGORY_ICONS: Record<string, string> = {
  TRAVEL: 'flight', FOOD: 'restaurant', OFFICE: 'business_center',
  CLIENT_VISIT: 'domain', HOTEL: 'hotel', STATIONERY: 'edit_note', MISC: 'category',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-on-surface-variant/10 text-on-surface-variant border-outline-variant/30',
  SUBMITTED: 'bg-primary/10 text-primary border-primary/20',
  L1_REVIEW: 'bg-primary/10 text-primary border-primary/20',
  FINANCE_REVIEW: 'bg-primary/10 text-primary border-primary/20',
  APPROVED: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  REJECTED: 'bg-error/10 text-error border-error/20',
  PAID: 'bg-tertiary/10 text-tertiary border-tertiary/20',
};

export default function ExpenseTrackerPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [myExpenses, setMyExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: 'TRAVEL',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    paymentMode: 'UPI',
  });

  const load = async () => {
    try {
      const mine = await expensesService.my().catch(() => []);
      setMyExpenses(Array.isArray(mine) ? mine : mine?.data ?? []);
      if (isAdmin) {
        const all = await expensesService.all({ status: 'SUBMITTED' }).catch(() => []);
        setAllExpenses(Array.isArray(all) ? all : all?.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.amount || !form.expenseDate) {
      setMsg({ text: 'Amount and date are required', ok: false });
      return;
    }
    setSubmitting(true);
    try {
      await expensesService.submit({ ...form, amount: parseFloat(form.amount) });
      setMsg({ text: 'Expense submitted!', ok: true });
      setShowForm(false);
      setForm({ category: 'TRAVEL', amount: '', expenseDate: new Date().toISOString().slice(0, 10), description: '', paymentMode: 'UPI' });
      await load();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message ?? 'Failed to submit', ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string, isL1: boolean) => {
    setActionLoading(id);
    try {
      if (isL1) await expensesService.approveL1(id, 'APPROVE');
      else await expensesService.approveFinance(id, 'APPROVE');
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const totalPending = myExpenses
    .filter(e => ['SUBMITTED', 'L1_REVIEW', 'FINANCE_REVIEW'].includes(e.status))
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalApproved = myExpenses
    .filter(e => e.status === 'APPROVED' || e.status === 'PAID')
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          EXPENSES
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Expense Tracker</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Expense Tracker</h2>
            <p className="text-on-surface-variant mt-xs">Submit, track, and manage expense claims.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-xs text-label-caps font-label-caps bg-primary text-on-primary px-4 py-2 rounded-full hover:opacity-90 shrink-0">
            <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'New Claim'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {[
            { label: 'Total Claims', value: myExpenses.length, icon: 'receipt_long', color: 'text-primary' },
            { label: 'Pending', value: myExpenses.filter(e => ['SUBMITTED', 'L1_REVIEW', 'FINANCE_REVIEW'].includes(e.status)).length, icon: 'pending', color: 'text-primary' },
            { label: 'Pending Amount', value: `₹${totalPending.toLocaleString('en-IN')}`, icon: 'currency_rupee', color: 'text-error' },
            { label: 'Approved', value: `₹${totalApproved.toLocaleString('en-IN')}`, icon: 'check_circle', color: 'text-tertiary' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex flex-col gap-sm card-hover">
              <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
              <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-body-sm text-on-surface-variant">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* New claim form */}
      {showForm && (
        <div className="glass-card rounded-2xl p-lg border border-primary/30">
          <p className="font-label-caps text-label-caps text-primary tracking-widest mb-md">NEW EXPENSE CLAIM</p>
          {msg.text && (
            <div className={`mb-sm text-sm font-semibold px-4 py-2 rounded-full ${msg.ok ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">CATEGORY</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none">
                {Object.keys(CATEGORY_ICONS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">AMOUNT (₹)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">DATE</label>
              <input type="date" value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">PAYMENT MODE</label>
              <select value={form.paymentMode} onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none">
                {['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-xs">
              <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">DESCRIPTION</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the expense..."
                className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="mt-md bg-primary text-on-primary font-label-caps text-label-caps px-lg py-2 rounded-full hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </div>
      )}

      {/* My expenses */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">MY CLAIMS</p>
        {loading ? (
          <div className="flex flex-col gap-xs">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
          </div>
        ) : myExpenses.length === 0 ? (
          <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
            No expense claims yet.
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="divide-y divide-outline-variant/20">
              {myExpenses.slice(0, 20).map(exp => (
                <div key={exp.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">{CATEGORY_ICONS[exp.category] ?? 'receipt'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{exp.category}</p>
                    <p className="text-body-sm text-on-surface-variant">{new Date(exp.expenseDate).toLocaleDateString('en-IN')} · {exp.paymentMode}</p>
                  </div>
                  <p className="font-bold text-on-surface">₹{Number(exp.amount).toLocaleString('en-IN')}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[exp.status]}`}>{exp.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin: Approval queue */}
      {isAdmin && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">
            APPROVAL QUEUE
            {allExpenses.length > 0 && (
              <span className="ml-sm bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full">{allExpenses.length}</span>
            )}
          </p>
          {loading ? (
            <div className="flex flex-col gap-xs">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
            </div>
          ) : allExpenses.length === 0 ? (
            <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
              No expenses pending approval.
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
              <div className="divide-y divide-outline-variant/20">
                {allExpenses.map(exp => {
                  const isL1 = exp.status === 'SUBMITTED';
                  return (
                    <div key={exp.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors flex-wrap">
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                        {exp.employee?.firstName?.[0]}{exp.employee?.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface text-sm">{exp.employee?.firstName} {exp.employee?.lastName}</p>
                        <p className="text-body-sm text-on-surface-variant">{exp.category} · {new Date(exp.expenseDate).toLocaleDateString('en-IN')}</p>
                      </div>
                      <p className="font-bold text-on-surface">₹{Number(exp.amount).toLocaleString('en-IN')}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLOR[exp.status]}`}>{exp.status}</span>
                      <button onClick={() => handleApprove(exp.id, isL1)} disabled={actionLoading === exp.id}
                        className="bg-tertiary/10 text-tertiary border border-tertiary/20 font-label-caps text-[10px] px-3 py-1.5 rounded-full hover:bg-tertiary/20 transition-colors disabled:opacity-50 shrink-0">
                        {actionLoading === exp.id ? '...' : isL1 ? 'L1 Approve' : 'Finance Approve'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
