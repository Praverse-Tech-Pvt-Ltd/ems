'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { requestsService } from '@/lib/api/requests';
import { X, Plus, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle, FileText, Laptop, Home, PlaneTakeoff, CreditCard, ClipboardList } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────── */
type RequestType = 'WFH' | 'ADVANCE_PAYMENT' | 'DOCUMENT_REQUEST' | 'ASSET_REQUEST' | 'TRAVEL_APPROVAL' | 'ATTENDANCE_CORRECTION' | 'OTHER';
type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW' | 'CANCELLED';

interface EmployeeRequest {
  id: string;
  requestType: RequestType;
  status: RequestStatus;
  details: { subject?: string; description?: string } & Record<string, unknown>;
  createdAt: string;
  reviewedAt?: string | null;
  comment?: string | null;
  employee?: { firstName: string; lastName: string; employeeCode: string };
}

/* ── Config ─────────────────────────────────────────────────────────── */
const REQUEST_TYPES: { key: RequestType; label: string; icon: React.ElementType; desc: string; color: string; bg: string }[] = [
  { key: 'WFH',                  label: 'Work From Home',       icon: Home,          desc: 'Request remote work days',         color: '#01677d', bg: 'rgba(1,103,125,0.10)' },
  { key: 'ADVANCE_PAYMENT',      label: 'Salary Advance',       icon: CreditCard,    desc: 'Early salary disbursement',        color: '#aa3000', bg: 'rgba(170,48,0,0.10)' },
  { key: 'DOCUMENT_REQUEST',     label: 'Document Request',     icon: FileText,      desc: 'Letters, certificates, NOC',       color: '#6d5a00', bg: 'rgba(109,90,0,0.10)' },
  { key: 'ASSET_REQUEST',        label: 'Asset Request',        icon: Laptop,        desc: 'Equipment, tools, hardware',       color: '#006637', bg: 'rgba(0,102,55,0.10)' },
  { key: 'TRAVEL_APPROVAL',      label: 'Travel Approval',      icon: PlaneTakeoff,  desc: 'Official travel & expenses',       color: '#4a1977', bg: 'rgba(74,25,119,0.10)' },
  { key: 'ATTENDANCE_CORRECTION',label: 'Attendance Fix',       icon: Clock,         desc: 'Correct punch in/out records',     color: '#8a2000', bg: 'rgba(138,32,0,0.10)' },
  { key: 'OTHER',                label: 'Other Request',        icon: ClipboardList, desc: 'Anything else you need',           color: '#59413a', bg: 'rgba(89,65,58,0.10)' },
];

const STATUS_CONFIG: Record<RequestStatus, { label: string; icon: React.ElementType; pill: string; dot: string }> = {
  PENDING:      { label: 'Pending',   icon: Clock,          pill: 'bg-tertiary/10 text-tertiary border-tertiary/20',                       dot: 'bg-tertiary' },
  UNDER_REVIEW: { label: 'In Review', icon: AlertCircle,    pill: 'bg-secondary/10 text-secondary border-secondary/20',                    dot: 'bg-secondary animate-pulse' },
  APPROVED:     { label: 'Approved',  icon: CheckCircle2,   pill: 'bg-success/10 text-success border-success/20',                          dot: 'bg-success' },
  REJECTED:     { label: 'Rejected',  icon: XCircle,        pill: 'bg-error/10 text-error border-error/20',                               dot: 'bg-error' },
  CANCELLED:    { label: 'Cancelled', icon: XCircle,        pill: 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20', dot: 'bg-on-surface-variant' },
};

/* ── Helpers ─────────────────────────────────────────────────────────── */
function typeConfig(type: RequestType): typeof REQUEST_TYPES[number] {
  return REQUEST_TYPES.find(t => t.key === type) ?? REQUEST_TYPES[REQUEST_TYPES.length - 1]!;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRel(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

/* ── New Request Drawer ────────────────────────────────────────────── */
function NewRequestDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [form, setForm] = useState({ subject: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => { setStep('type'); setSelectedType(null); setForm({ subject: '', description: '' }); setDone(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !form.subject || !form.description) return;
    setSubmitting(true);
    try {
      await requestsService.create(selectedType, { subject: form.subject, description: form.description });
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      setDone(true);
    } catch {
      // show error inline could be added; for now just close
    } finally {
      setSubmitting(false);
    }
  };

  const tc = selectedType ? typeConfig(selectedType) : null;

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />
      )}
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 'min(100vw, 480px)', background: 'rgba(250,248,255,0.98)', borderLeft: '1px solid rgba(226,191,181,0.5)', boxShadow: '-24px 0 80px rgba(19,27,46,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(226,191,181,0.4)' }}>
          <div className="flex items-center gap-3">
            {step === 'form' && !done && (
              <button onClick={() => setStep('type')} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
                <ChevronRight size={14} className="rotate-180" />
              </button>
            )}
            <div>
              <div className="text-[11px] font-bold text-primary tracking-[0.08em] uppercase">
                {done ? 'Submitted' : step === 'type' ? 'New Request' : tc?.label}
              </div>
              <div className="text-[13px] font-bold text-on-surface leading-tight mt-0.5">
                {done ? 'Your request is on its way' : step === 'type' ? 'Choose request type' : 'Fill in details'}
              </div>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {done ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-16">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.12)', boxShadow: '0 0 0 8px rgba(5,150,105,0.06)' }}>
                <CheckCircle2 size={36} className="text-success" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-on-surface">Request Submitted!</p>
                <p className="text-[12.5px] text-on-surface-variant mt-1.5 leading-relaxed max-w-[260px]">
                  Your <span className="font-semibold text-on-surface">{tc?.label}</span> request is now pending admin review. You'll be notified once it's processed.
                </p>
              </div>
              <button
                onClick={() => { reset(); }}
                className="mt-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-on-primary transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#aa3000,#c53800)', boxShadow: '0 4px 16px rgba(170,48,0,0.25)' }}
              >
                Submit Another
              </button>
            </div>
          ) : step === 'type' ? (
            <div className="grid grid-cols-1 gap-3">
              {REQUEST_TYPES.map(rt => {
                const Icon = rt.icon;
                return (
                  <button
                    key={rt.key}
                    onClick={() => { setSelectedType(rt.key); setStep('form'); }}
                    className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 active:scale-[0.98] hover:shadow-sm"
                    style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(226,191,181,0.4)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: rt.bg }}>
                      <Icon size={18} style={{ color: rt.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-on-surface">{rt.label}</div>
                      <div className="text-[11.5px] text-on-surface-variant mt-0.5">{rt.desc}</div>
                    </div>
                    <ChevronRight size={15} className="text-on-surface-variant/50 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Type badge */}
              {tc && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: tc.bg, border: `1px solid ${tc.color}20` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tc.color}20` }}>
                    <tc.icon size={16} style={{ color: tc.color }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold" style={{ color: tc.color }}>{tc.label}</div>
                    <div className="text-[11px] text-on-surface-variant">{tc.desc}</div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10.5px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Subject / Title</label>
                <input
                  required
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. WFH request for June 15–16"
                  className="w-full px-4 py-2.5 rounded-xl border border-card-border bg-surface-container-low text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  required
                  rows={5}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Provide context, dates, amounts, or any supporting information…"
                  className="w-full px-4 py-2.5 rounded-xl border border-card-border bg-surface-container-low text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !form.subject || !form.description}
                className="w-full py-3 rounded-xl text-[13.5px] font-bold text-on-primary flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#aa3000,#c53800)', boxShadow: '0 4px 16px rgba(170,48,0,0.25)' }}
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Request Card ────────────────────────────────────────────────────── */
function RequestCard({ req, onAdminAction }: { req: EmployeeRequest; onAdminAction?: (id: string, status: 'APPROVED' | 'REJECTED', comment: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  const tc = typeConfig(req.requestType);
  const sc = STATUS_CONFIG[req.status];
  const Icon = tc.icon;
  const StatusIcon = sc.icon;
  const subject = req.details?.subject ?? tc.label;
  const description = req.details?.description ?? '';

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    if (!onAdminAction) return;
    setActioning(status);
    await onAdminAction(req.id, status, adminNote);
    setActioning(null);
    setExpanded(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(226,191,181,0.4)', boxShadow: '0 2px 8px rgba(19,27,46,0.04)' }}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 cursor-pointer hover:bg-surface-container-low/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Type icon */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg }}>
          <Icon size={16} style={{ color: tc.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              {req.employee && (
                <div className="text-[11px] font-bold text-on-surface-variant/70 mb-0.5">
                  {req.employee.firstName} {req.employee.lastName} · {req.employee.employeeCode}
                </div>
              )}
              <div className="text-[13px] sm:text-[14px] font-bold text-on-surface truncate">{subject}</div>
              <div className="text-[11.5px] text-on-surface-variant mt-0.5 line-clamp-1">{description}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${sc.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                <span className="hidden sm:inline">{sc.label}</span>
                <StatusIcon size={10} className="sm:hidden" />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant/60 font-medium">
            <span style={{ color: tc.color, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tc.label}</span>
            <span>·</span>
            <span>{fmtRel(req.createdAt)}</span>
            {req.reviewedAt && <><span>·</span><span>Resolved {fmt(req.reviewedAt)}</span></>}
          </div>
        </div>

        {/* Expand chevron */}
        <ChevronRight
          size={15}
          className={`text-on-surface-variant/40 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0" style={{ borderTop: '1px solid rgba(226,191,181,0.3)' }}>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-1">Full Description</div>
              <p className="text-[12.5px] text-on-surface leading-relaxed">{description}</p>
            </div>
            {req.comment && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(1,103,125,0.06)', border: '1px solid rgba(1,103,125,0.15)' }}>
                <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Admin Note</div>
                <p className="text-[12.5px] text-on-surface">{req.comment}</p>
              </div>
            )}
            {onAdminAction && req.status === 'PENDING' && (
              <div className="flex flex-col gap-2 pt-2">
                <textarea
                  rows={2}
                  placeholder="Add a note (optional)…"
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-card-border bg-surface-container-low text-[12px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction('APPROVED')}
                    disabled={actioning !== null}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold text-success bg-success/10 border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
                  >
                    {actioning === 'APPROVED' ? '…' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleAction('REJECTED')}
                    disabled={actioning !== null}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold text-error bg-error/10 border border-error/20 hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {actioning === 'REJECTED' ? '…' : '✗ Reject'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: bg, border: `1px solid ${color}20` }}>
      <span className="text-[18px] sm:text-[22px] font-black" style={{ color }}>{count}</span>
      <span className="text-[10.5px] font-bold text-on-surface-variant leading-tight">{label}</span>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function RequestsPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<'mine' | 'queue'>('mine');
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<RequestType | 'ALL'>('ALL');

  /* ── API: my requests ── */
  const myQ = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => requestsService.my() as Promise<EmployeeRequest[]>,
  });
  const myRequests: EmployeeRequest[] = myQ.data ?? [];

  /* ── API: admin queue ── */
  const adminQ = useQuery({
    queryKey: ['admin-requests'],
    queryFn: () => requestsService.all({ status: 'PENDING' }) as Promise<EmployeeRequest[]>,
    enabled: isAdmin,
  });
  const adminRequests: EmployeeRequest[] = adminQ.data ?? [];

  /* ── Admin action ── */
  const handleAdminAction = async (id: string, status: 'APPROVED' | 'REJECTED', comment: string) => {
    try {
      await requestsService.approve(id, status, comment || undefined);
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['my-requests'] });
    } catch { /* ignore */ }
  };

  /* ── Filtered lists ── */
  const filteredMine = myRequests.filter(r =>
    (filterStatus === 'ALL' || r.status === filterStatus) &&
    (filterType === 'ALL' || r.requestType === filterType)
  );

  const pendingCount = adminRequests.filter(r => r.status === 'PENDING').length;

  /* ── Stats ── */
  const totalMine    = myRequests.length;
  const approvedMine = myRequests.filter(r => r.status === 'APPROVED').length;
  const pendingMine  = myRequests.filter(r => r.status === 'PENDING').length;
  const rejectedMine = myRequests.filter(r => r.status === 'REJECTED').length;

  return (
    <>
      <NewRequestDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex flex-col gap-5 sm:gap-6 max-w-[860px] mx-auto w-full pb-8 animate-fade-in">

        {/* ── Page Header ── */}
        <div style={{ borderBottom: '1px solid rgba(226,191,181,0.5)', paddingBottom: '1rem' }}>
          <div className="flex items-center gap-2 text-[10.5px] font-bold text-primary tracking-[0.1em] uppercase mb-1.5">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            REQUESTS
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[22px] sm:text-[28px] font-black text-on-surface leading-tight" style={{ letterSpacing: '-0.02em' }}>
                My Requests
              </h1>
              <p className="text-[12.5px] sm:text-[13px] text-on-surface-variant mt-1">
                WFH, documents, advances, assets, travel — all in one place.
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[13px] font-bold text-on-primary flex-shrink-0 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#aa3000,#c53800)', boxShadow: '0 4px 16px rgba(170,48,0,0.25)' }}
            >
              <Plus size={15} />
              <span className="hidden xs:inline">New Request</span>
              <span className="xs:hidden">New</span>
            </button>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <StatPill label="Total" count={totalMine} color="#59413a" bg="rgba(89,65,58,0.07)" />
          <StatPill label="Pending" count={pendingMine} color="#01677d" bg="rgba(1,103,125,0.08)" />
          <StatPill label="Approved" count={approvedMine} color="#059669" bg="rgba(5,150,105,0.08)" />
          <StatPill label="Rejected" count={rejectedMine} color="#ba1a1a" bg="rgba(186,26,26,0.08)" />
        </div>

        {/* ── Quick action tiles ── */}
        <div>
          <div className="text-[10px] font-bold text-on-surface-variant/60 tracking-widest uppercase mb-2.5">Quick Submit</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {REQUEST_TYPES.slice(0, 4).map(rt => {
              const Icon = rt.icon;
              return (
                <button
                  key={rt.key}
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-col items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl text-left transition-all duration-150 active:scale-[0.97] hover:shadow-md"
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(226,191,181,0.4)', boxShadow: '0 2px 8px rgba(19,27,46,0.04)' }}
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center" style={{ background: rt.bg }}>
                    <Icon size={15} style={{ color: rt.color }} />
                  </div>
                  <div>
                    <div className="text-[11.5px] sm:text-[12.5px] font-bold text-on-surface leading-tight">{rt.label}</div>
                    <div className="text-[10px] sm:text-[10.5px] text-on-surface-variant mt-0.5 hidden sm:block">{rt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tabs (admin only) ── */}
        {isAdmin && (
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(19,27,46,0.04)', border: '1px solid rgba(226,191,181,0.3)' }}>
            {(['mine', 'queue'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12.5px] font-bold transition-all duration-150 ${tab === t ? 'text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                style={tab === t ? { background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(19,27,46,0.08)' } : {}}
              >
                {t === 'mine' ? 'My Requests' : (
                  <>
                    Admin Queue
                    {pendingCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-on-primary" style={{ background: '#aa3000' }}>{pendingCount}</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        {(tab === 'mine' || !isAdmin) && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {(['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${filterStatus === s ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-card text-on-surface-variant border-card-border hover:border-primary/30 hover:text-on-surface'}`}
              >
                {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}

        {/* ── Request list ── */}
        {tab === 'mine' || !isAdmin ? (
          <div className="flex flex-col gap-3">
            {myQ.isLoading ? (
              [1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(19,27,46,0.05)' }} />)
            ) : filteredMine.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(89,65,58,0.08)' }}>
                  <ClipboardList size={28} className="text-on-surface-variant/40" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-bold text-on-surface">No requests yet</p>
                  <p className="text-[12px] text-on-surface-variant mt-1">Submit your first request using the button above.</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="px-5 py-2.5 rounded-xl text-[12.5px] font-bold text-on-primary mt-1 transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#aa3000,#c53800)' }}
                >
                  New Request
                </button>
              </div>
            ) : (
              filteredMine.map(req => <RequestCard key={req.id} req={req} />)
            )}
          </div>
        ) : (
          /* Admin queue */
          <div className="flex flex-col gap-3">
            {adminQ.isLoading ? (
              [1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(19,27,46,0.05)' }} />)
            ) : adminRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 size={40} className="text-success/50" />
                <p className="text-[14px] font-bold text-on-surface">All clear!</p>
                <p className="text-[12px] text-on-surface-variant">No pending requests in the queue.</p>
              </div>
            ) : (
              adminRequests.map(req => <RequestCard key={req.id} req={req} onAdminAction={handleAdminAction} />)
            )}
          </div>
        )}
      </div>
    </>
  );
}
