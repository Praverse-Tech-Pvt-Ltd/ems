'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import type { Expense, ExpenseStatus, ExpenseCategory, PaymentMode } from '@/types';
import {
  Plane, Coffee, Receipt, Heart, CreditCard, Filter, Plus, ChevronRight, Package, X,
} from 'lucide-react';

const CATEGORY_ICON: Record<string, React.ElementType> = {
  TRAVEL:       Plane,
  FOOD:         Coffee,
  OFFICE:       Receipt,
  CLIENT_VISIT: Heart,
  HOTEL:        Coffee,
  STATIONERY:   Receipt,
  MISC:         CreditCard,
};

const CATEGORY_LABEL: Record<string, string> = {
  TRAVEL:       'TRAVEL EXPENSE',
  FOOD:         'FOOD & MEALS',
  OFFICE:       'OFFICE SUPPLIES',
  CLIENT_VISIT: 'CLIENT HOSPITALITY',
  HOTEL:        'ACCOMMODATION',
  STATIONERY:   'STATIONERY',
  MISC:         'MISCELLANEOUS',
};

function statusTone(s: ExpenseStatus): string {
  if (s === 'APPROVED' || s === 'PAID')            return 'ok';
  if (s === 'FINANCE_REVIEW' || s === 'L1_REVIEW') return 'info';
  if (s === 'SUBMITTED' || s === 'DRAFT')           return 'hold';
  if (s === 'REJECTED')                             return 'red';
  return 'hold';
}

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  DRAFT:          'DRAFT',
  SUBMITTED:      'AWAITING MANAGER',
  L1_REVIEW:      'MANAGER REVIEW',
  FINANCE_REVIEW: 'UNDER FINANCE REVIEW',
  APPROVED:       'APPROVED',
  REJECTED:       'REJECTED',
  PAID:           'PAID',
};

const ACCENT: Record<string, string> = {
  ok:   'bg-[#0F8F3A]',
  info: 'bg-brutal-blue',
  hold: 'bg-brutal-yellow',
  red:  'bg-brutal-red',
};
const TONE_TAG: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  red:  'bg-brutal-red text-white',
};

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? 'bg-brutal-surface text-brutal-ink'}`}>
      {children}
    </span>
  );
}

const ALL_STATUSES = ['ALL', 'AWAITING MANAGER', 'UNDER FINANCE REVIEW', 'APPROVED', 'REJECTED'] as const;
type FilterLabel = typeof ALL_STATUSES[number];

const FILTER_STATUS_MAP: Record<FilterLabel, ExpenseStatus[]> = {
  'ALL':                    [],
  'AWAITING MANAGER':       ['SUBMITTED'],
  'UNDER FINANCE REVIEW':   ['L1_REVIEW', 'FINANCE_REVIEW'],
  'APPROVED':               ['APPROVED', 'PAID'],
  'REJECTED':               ['REJECTED'],
};

interface ExpenseFormData {
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  paymentMode: PaymentMode;
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ExpenseFormData>({
    defaultValues: {
      category: 'MISC',
      amount: 0,
      description: '',
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMode: 'BANK_TRANSFER',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ExpenseFormData) => apiClient.post('/expenses', {
      ...data,
      amount: Number(data.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}>
      <div className="w-full max-w-[540px] brutal-border brutal-shadow-lg bg-brutal-cream animate-fade-up">
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">NEW</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">SUBMIT EXPENSE REQUEST</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          {mutation.isError && (
            <div className="p-3 bg-brutal-red text-white font-display font-bold text-[11px] tracking-[0.12em] brutal-border">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submission failed. Please try again.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">CATEGORY</label>
              <select {...register('category', { required: true })}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[12px] focus:outline-none">
                {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">AMOUNT (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...register('amount', { required: true, min: 1 })}
                className={`w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[12px] focus:outline-none ${errors.amount ? 'border-brutal-red' : ''}`}
                placeholder="0.00"
              />
              {errors.amount && <p className="mt-1 font-display font-bold text-[10px] text-brutal-red">Required · must be &gt; 0</p>}
            </div>

            <div>
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">EXPENSE DATE</label>
              <input
                type="date"
                {...register('expenseDate', { required: true })}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">PAYMENT MODE</label>
              <select {...register('paymentMode')}
                className="w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[12px] focus:outline-none">
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="UPI">UPI</option>
                <option value="CARD">CARD</option>
                <option value="CASH">CASH</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-display font-bold text-[10px] tracking-[0.2em] mb-1.5">DESCRIPTION</label>
              <textarea
                rows={3}
                {...register('description', { required: true })}
                className={`w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold text-[12px] focus:outline-none resize-none ${errors.description ? 'border-brutal-red' : ''}`}
                placeholder="Briefly describe the expense..."
              />
              {errors.description && <p className="mt-1 font-display font-bold text-[10px] text-brutal-red">Required</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="brutal-btn-primary px-5 py-3 text-[13px] disabled:opacity-60 flex items-center gap-2"
            >
              <Plus size={15} />
              {mutation.isPending ? 'SUBMITTING…' : 'SUBMIT REQUEST'}
            </button>
            <button type="button" onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function ExpensesPage() {
  const [filter, setFilter] = useState<FilterLabel>('ALL');
  const [showModal, setShowModal] = useState(false);

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => apiClient.get('/expenses').then(r => r.data).catch(() => []),
  });

  const filtered = useMemo(() => {
    if (filter === 'ALL') return expenses;
    const statuses = FILTER_STATUS_MAP[filter];
    return expenses.filter(e => statuses.includes(e.status));
  }, [filter, expenses]);

  const inFlight = expenses.filter(e => ['SUBMITTED', 'L1_REVIEW', 'FINANCE_REVIEW'].includes(e.status));
  const approved = expenses.filter(e => ['APPROVED', 'PAID'].includes(e.status));
  const rejected = expenses.filter(e => e.status === 'REJECTED');
  const ytdTotal = approved.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— EXPENSES & REQUESTS / 04</div>
          <h1 className="mt-2 font-display font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-tight">
            YOUR <span className="inline-block bg-brutal-blue text-white px-2">QUEUE</span><span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-3 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">
            {expenses.length} ITEMS · YTD REIMBURSED {formatCurrency(ytdTotal)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="brutal-btn-secondary px-5 py-3 text-[13px] flex items-center gap-2">
            <Filter size={14} /> FILTERS
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
          >
            <Plus size={15} /> SUBMIT NEW REQUEST
          </button>
        </div>
      </div>

      {/* Summary blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 brutal-border brutal-shadow">
        {[
          { l: 'IN FLIGHT',      v: String(inFlight.length), s: 'AWAITING DECISION',              bg: 'bg-brutal-yellow' },
          { l: 'APPROVED · ALL', v: String(approved.length), s: formatCurrency(ytdTotal) + ' CLEARED', bg: 'bg-[#0F8F3A] text-white' },
          { l: 'REJECTED',       v: String(rejected.length), s: 'SEE REASON CODES',               bg: 'bg-brutal-red text-white' },
          { l: 'TOTAL',          v: String(expenses.length), s: 'ALL REQUESTS',                    bg: 'bg-brutal-surface' },
        ].map((s, i) => (
          <div key={s.l} className={`p-5 ${i < 3 ? 'brutal-border-b md:border-b-0 md:brutal-border-r' : ''} ${s.bg}`}>
            <div className="font-display font-bold text-[10px] tracking-[0.22em]">{s.l}</div>
            <div className="mt-2 text-[32px] sm:text-[40px] lg:text-[44px] leading-[0.9] font-bold num">{isLoading ? '—' : s.v}</div>
            <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em]">{s.s}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map(f => {
          const active = filter === f;
          const statuses = FILTER_STATUS_MAP[f];
          const count = f === 'ALL' ? expenses.length : expenses.filter(e => statuses.includes(e.status)).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-display font-bold text-[11px] tracking-[0.16em] px-3 py-2 border-2 border-brutal-ink inline-flex items-center gap-2 transition-colors
                ${active ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-cream hover:bg-brutal-yellow'}`}
            >
              {f}
              <span className={`num text-[10px] px-1 ${active ? 'bg-brutal-yellow text-brutal-ink' : 'bg-brutal-ink text-brutal-cream'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="brutal-border diag bg-brutal-cream p-12 text-center">
          <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
            LOADING EXPENSES…
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e, i) => {
            const tone  = statusTone(e.status);
            const Icon  = CATEGORY_ICON[e.category] ?? Package;
            const label = CATEGORY_LABEL[e.category] ?? e.category;
            const statusLabel = STATUS_LABEL[e.status] ?? e.status;
            return (
              <div
                key={e.id}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-fade-up grid grid-cols-12 items-stretch brutal-border brutal-shadow-sm hover:brutal-shadow hover:-translate-x-px hover:-translate-y-px transition-all"
              >
                <div className={`col-span-12 sm:col-span-1 ${ACCENT[tone] ?? 'bg-brutal-surface'} grid place-items-center sm:brutal-border-r brutal-border-b sm:border-b-0 py-3`}>
                  <Icon size={18} className={tone === 'hold' ? 'text-brutal-ink' : 'text-white'} />
                </div>
                <div className="col-span-12 sm:col-span-5 px-5 py-3 sm:brutal-border-r flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">{e.id.slice(0, 8).toUpperCase()}</span>
                    <span className="w-1 h-1 bg-brutal-ink" />
                    <span className="font-display font-bold text-[14px] tracking-tight">{label}</span>
                  </div>
                  <div className="font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/60 truncate mt-0.5">
                    {e.description ?? e.category} · {e.paymentMode ?? 'BANK TRANSFER'}
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center">
                  <span className="font-display font-bold text-[12px] tracking-[0.12em] num">{formatDate(e.expenseDate)}</span>
                </div>
                <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center justify-end">
                  <span className="text-[17px] font-bold num tracking-tight">{formatCurrency(e.amount)}</span>
                </div>
                <div className="col-span-12 sm:col-span-2 px-3 py-3 flex items-center justify-end gap-2">
                  <Tag tone={tone}>{statusLabel}</Tag>
                  <button className="w-8 h-8 grid place-items-center border-[3px] border-brutal-ink hover:bg-brutal-yellow transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="brutal-border diag bg-brutal-cream p-12 text-center">
              <div className="bg-brutal-cream inline-block px-4 py-2 brutal-border brutal-shadow font-display font-bold text-[11px] tracking-[0.22em]">
                NOTHING MATCHES THAT FILTER
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <SubmitModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
