'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { employeesService } from '@/lib/api/employees';
import { attendanceService } from '@/lib/api/attendance';
import { leavesService } from '@/lib/api/leaves';
import { useAuthStore } from '@/store/auth.store';
import { isAttendanceBlockedUser } from '@/lib/attendance-access';
import type { Employee, AttendanceStats, LeaveBalance } from '@/types';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Shield, Building2, User, X, Save, Loader2, Camera, Trash2, Check } from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────────────── */
const ROLE_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  SUPER_ADMIN: { text: 'text-error',              bg: 'bg-error/10',              border: 'border-error/20' },
  ADMIN:       { text: 'text-primary',            bg: 'bg-primary/10',            border: 'border-primary/20' },
  MANAGER:     { text: 'text-tertiary',           bg: 'bg-tertiary/10',           border: 'border-tertiary/20' },
  EMPLOYEE:    { text: 'text-on-surface-variant', bg: 'bg-on-surface-variant/10', border: 'border-on-surface-variant/20' },
};

const LEAVE_COLOR: Record<string, string> = {
  PL: '#aa3000', CL: '#059669', SL: '#ba1a1a', UL: '#7c4dff', CO: '#01677d',
};

type EmployeeAttendanceOverview = {
  period: { month: string };
  summary: {
    totalRecords: number;
    present: number;
    late: number;
    halfDay: number;
    leave: number;
    absent: number;
    wfh: number;
    attended: number;
    lateFrequency: number;
    punctuality: number;
    totalHours: number;
  };
  today: any | null;
  records: any[];
};

type EmployeeLeaveOverview = {
  requests: any[];
  balances: LeaveBalance[];
  summary: {
    submitted: number;
    pending: number;
    approved: number;
    rejected: number;
    approvedDays: number;
  };
};

function initials(emp: Employee) {
  return `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Skeleton ────────────────────────────────────────────────────────── */
function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-container-high ${className}`} />;
}

/* ── Info row ────────────────────────────────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-container text-on-surface-variant">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold text-on-surface-variant/55 uppercase tracking-wide">{label}</div>
        <div className="text-[13px] font-medium text-on-surface mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

/* ── Field ───────────────────────────────────────────────────────────── */
function Field({
  label, name, value, onChange, type = 'text', readOnly = false,
}: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void;
  type?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        readOnly={readOnly}
        className={`w-full px-3 py-2 rounded-xl text-[13px] font-medium text-on-surface border outline-none transition-all
          ${readOnly
            ? 'bg-surface-container/50 border-card-border/50 text-on-surface-variant cursor-not-allowed'
            : 'bg-card border-card-border focus:border-secondary focus:shadow-[0_0_0_2px_rgba(1,103,125,0.15)]'
          }`}
      />
    </div>
  );
}

/* ── Photo Modal ─────────────────────────────────────────────────────── */
const POSITIONS = [
  { label: 'Top Left',     value: 'top left' },
  { label: 'Top Center',   value: 'top center' },
  { label: 'Top Right',    value: 'top right' },
  { label: 'Center Left',  value: 'center left' },
  { label: 'Center',       value: 'center' },
  { label: 'Center Right', value: 'center right' },
  { label: 'Bottom Left',  value: 'bottom left' },
  { label: 'Bottom Center',value: 'bottom center' },
  { label: 'Bottom Right', value: 'bottom right' },
] as const;

function PhotoModal({
  currentUrl, onClose, onSaved,
}: {
  currentUrl?: string; onClose: () => void; onSaved: (url: string) => void;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [preview,  setPreview]  = useState<string>(currentUrl ?? '');
  const [position, setPosition] = useState('center');
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [removing, setRemoving] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    // Frontend-only: set the preview URL as the profile photo URL on the employee record
    // In production this would upload the file then patch the employee
    await new Promise(r => setTimeout(r, 700)); // simulate upload
    setSuccess(true);
    setTimeout(() => { onSaved(preview); onClose(); }, 800);
    setSaving(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    await new Promise(r => setTimeout(r, 500));
    onSaved('');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-full max-w-[420px] rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(250,248,255,0.98)',
            boxShadow: '0 24px 64px rgba(19,27,46,0.16)',
            border: '1px solid rgba(226,191,181,0.5)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(226,191,181,0.35)' }}>
            <div>
              <h2 className="text-[15px] font-bold text-on-surface">Profile Photo</h2>
              <p className="text-[11.5px] text-on-surface-variant mt-0.5">Upload a photo and choose what's visible</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Preview */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-card shadow-lg relative"
                style={{ boxShadow: '0 4px 16px rgba(170,48,0,0.15)' }}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{ objectPosition: position }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#aa3000,#d04411)' }}>
                    <Camera size={32} className="text-white/60" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant/60 font-medium">Live preview · adjusts with focus area</p>
            </div>

            {/* Upload button */}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-on-surface border border-card-border bg-card hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
            >
              <Camera size={14} />
              {preview ? 'Change Photo' : 'Upload Photo'}
            </button>

            {/* Focus area selector */}
            {preview && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wide">Focus Area</p>
                <p className="text-[11px] text-on-surface-variant/50">Select which part of your photo to show in the profile circle</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {POSITIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPosition(p.value)}
                      className="py-1.5 px-2 rounded-lg text-[10.5px] font-semibold transition-all"
                      style={position === p.value ? {
                        background: '#aa3000',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(170,48,0,0.25)',
                      } : {
                        background: 'rgba(19,27,46,0.04)',
                        color: '#59413a',
                        border: '1px solid rgba(226,191,181,0.4)',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-5 pb-5">
            {currentUrl && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold text-error border border-error/20 bg-error/5 hover:bg-error/10 transition-colors"
              >
                {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Remove
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!preview || saving || success}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-primary flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: success
                  ? 'linear-gradient(135deg,#059669,#047857)'
                  : 'linear-gradient(135deg,#aa3000,#c53800)',
                boxShadow: success
                  ? '0 2px 10px rgba(5,150,105,0.25)'
                  : '0 2px 10px rgba(170,48,0,0.25)',
              }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : success ? <Check size={13} /> : <Save size={13} />}
              {saving ? 'Saving…' : success ? 'Saved!' : 'Save Photo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Edit Drawer ─────────────────────────────────────────────────────── */
function EditDrawer({
  emp, onClose, onSaved,
}: {
  emp: Employee; onClose: () => void; onSaved: (updated: Employee) => void;
}) {
  const [form, setForm] = useState({
    firstName:        emp.firstName,
    lastName:         emp.lastName,
    phone:            emp.phone ?? '',
    address:          emp.address ?? '',
    emergencyContact: emp.emergencyContact ?? '',
    designation:      emp.designation ?? '',
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [err,     setErr]     = useState('');

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      const updated: Employee = await employeesService.update(emp.id, {
        firstName:        form.firstName,
        lastName:         form.lastName,
        phone:            form.phone   || undefined,
        address:          form.address || undefined,
        emergencyContact: form.emergencyContact || undefined,
        designation:      form.designation      || undefined,
      });
      setSuccess(true);
      setTimeout(() => { onSaved(updated); onClose(); }, 800);
    } catch {
      setErr('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] flex flex-col"
        style={{
          background: 'rgba(250,248,255,0.97)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(226,191,181,0.5)',
          boxShadow: '-8px 0 40px rgba(19,27,46,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(226,191,181,0.4)' }}
        >
          <div>
            <h2 className="text-[16px] font-bold text-on-surface tracking-tight">Edit Profile</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              {emp.firstName} {emp.lastName} · #{emp.employeeCode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Personal */}
          <div>
            <div className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-[0.08em] mb-3">
              Personal Info
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" name="firstName" value={form.firstName} onChange={set} />
              <Field label="Last Name"  name="lastName"  value={form.lastName}  onChange={set} />
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Phone"             name="phone"            value={form.phone}            onChange={set} type="tel" />
              <Field label="Address"           name="address"          value={form.address}          onChange={set} />
              <Field label="Emergency Contact" name="emergencyContact" value={form.emergencyContact} onChange={set} />
            </div>
          </div>

          {/* Work — read-only fields */}
          <div>
            <div className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-[0.08em] mb-3">
              Work Details <span className="normal-case font-normal text-on-surface-variant/40">(managed by HR)</span>
            </div>
            <div className="space-y-3">
              <Field label="Designation" name="designation" value={form.designation} onChange={set} />
              <Field label="Department"  name="department"  value={emp.department?.name ?? ''} onChange={() => {}} readOnly />
              <Field label="Email"       name="email"       value={emp.email}                  onChange={() => {}} readOnly />
              <Field label="Employee Code" name="code"      value={emp.employeeCode}            onChange={() => {}} readOnly />
              <Field label="Joining Date"  name="joiningDate" value={fmtDate(emp.joiningDate)} onChange={() => {}} readOnly />
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-error/8 border border-error/20 text-[12.5px] text-error font-medium">
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-6 py-4 flex items-center gap-3"
          style={{ borderTop: '1px solid rgba(226,191,181,0.4)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-primary flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: success
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'linear-gradient(135deg, #aa3000 0%, #c53800 100%)',
              boxShadow: success
                ? '0 2px 10px rgba(5,150,105,0.28)'
                : '0 2px 10px rgba(170,48,0,0.28)',
            }}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : success ? (
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Saving…' : success ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
import { useQueryClient } from '@tanstack/react-query';
export default function EmployeeProfilePage() {
  const queryClient = useQueryClient();
  const params    = useParams();
  const router    = useRouter();
  const me        = useAuthStore(s => s.user);
  const rawId     = params?.id as string;
  const isSelf    = rawId === 'me' || rawId === me?.id;
  const isAdmin   = ['ADMIN', 'SUPER_ADMIN'].includes(me?.role ?? '');
  const attendanceBlockedSelf = isSelf && isAttendanceBlockedUser(me);

  const [emp,       setEmp]       = useState<Employee | null>(null);
  const [stats,     setStats]     = useState<AttendanceStats | null>(null);
  const [balance,   setBalance]   = useState<LeaveBalance[]>([]);
  const [attendanceOverview, setAttendanceOverview] = useState<EmployeeAttendanceOverview | null>(null);
  const [leaveOverview, setLeaveOverview] = useState<EmployeeLeaveOverview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [showEdit,  setShowEdit]  = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const empData: Employee = isSelf
          ? await queryClient.fetchQuery({ queryKey: ['employee-me', me?.id], queryFn: () => employeesService.me() })
          : await queryClient.fetchQuery({ queryKey: ['employee-id', rawId], queryFn: () => employeesService.byId(rawId) });
        setEmp(empData);

        if (isSelf && !attendanceBlockedSelf) {
          const [s, b] = await Promise.allSettled([
            queryClient.fetchQuery({ queryKey: ['attendance-stats', me?.id], queryFn: () => attendanceService.myStats() }),
            queryClient.fetchQuery({ queryKey: ['leaves-balance', me?.id], queryFn: () => leavesService.balance() }),
          ]);
          if (s.status === 'fulfilled') setStats(s.value);
          if (b.status === 'fulfilled') setBalance(Array.isArray(b.value) ? b.value : b.value?.data ?? []);
        } else if (isAdmin) {
          const [attendance, leave] = await Promise.allSettled([
            attendanceService.employeeOverview(rawId),
            leavesService.forEmployee(rawId),
          ]);
          if (attendance.status === 'fulfilled') setAttendanceOverview(attendance.value);
          if (leave.status === 'fulfilled') {
            setLeaveOverview(leave.value);
            setBalance(Array.isArray(leave.value?.balances) ? leave.value.balances : []);
          }
        }
      } catch {
        setError('Could not load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    if (rawId) load();
  }, [rawId, isSelf, attendanceBlockedSelf]);

  const roleStyle = ROLE_COLOR[emp?.role ?? 'EMPLOYEE'] ??
    { text: 'text-on-surface-variant', bg: 'bg-on-surface-variant/10', border: 'border-on-surface-variant/20' };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[860px] mx-auto space-y-5">
            <Skeleton className="h-8 w-36" />
            <div className="glass-card rounded-2xl p-6 flex gap-6">
              <Skeleton className="w-24 h-24 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !emp) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[860px] mx-auto">
            <div className="glass-card rounded-2xl p-10 flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>person_off</span>
              <p className="text-[14px] text-on-surface-variant/70 font-medium">
                {error || 'Employee not found'}
              </p>
              <button onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-[13px] font-semibold">
                <ArrowLeft size={14} /> Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const attendancePct = stats?.attendancePercent ?? null;
  const employeeAttendance = attendanceOverview?.summary;
  const employeeLeave = leaveOverview?.summary;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[900px] mx-auto space-y-5">

            {/* Back */}
            <button onClick={() => router.back()}
              className="flex items-center gap-2 text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              <ArrowLeft size={15} /> Back
            </button>

            {/* Hero */}
            <div className="glass-card rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 32px rgba(19,27,46,0.07)' }}>
              <div className="h-20 w-full" style={{
                background: 'linear-gradient(135deg, rgba(170,48,0,0.12) 0%, rgba(1,103,125,0.10) 60%, rgba(170,48,0,0.06) 100%)',
              }} />
              <div className="px-6 pb-6 -mt-10 flex flex-col sm:flex-row items-start sm:items-end gap-4">
                {/* Avatar with camera overlay */}
                <div className="relative flex-shrink-0 group/avatar">
                  {emp.profilePhotoUrl ? (
                    <img src={emp.profilePhotoUrl} alt={`${emp.firstName} ${emp.lastName}`}
                      className="w-20 h-20 rounded-2xl object-cover border-4 border-card shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-4 border-card shadow-lg flex items-center justify-center text-2xl font-black text-white"
                      style={{ background: 'linear-gradient(135deg, #aa3000 0%, #d04411 100%)', boxShadow: '0 4px 16px rgba(170,48,0,0.30)' }}>
                      {initials(emp)}
                    </div>
                  )}
                  {/* Camera overlay — self or admin only */}
                  {(isSelf || isAdmin) && (
                    <button
                      onClick={() => setShowPhoto(true)}
                      className="absolute inset-0 rounded-[14px] flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-200"
                      style={{ background: 'rgba(19,27,46,0.55)', backdropFilter: 'blur(2px)' }}
                      title="Change profile photo"
                    >
                      <Camera size={22} className="text-white" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 mt-2 sm:mt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[22px] font-black text-on-surface tracking-tight leading-none"
                      style={{ letterSpacing: '-0.02em' }}>
                      {emp.firstName} {emp.lastName}
                    </h1>
                    {isSelf && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(170,48,0,0.10)', color: '#aa3000' }}>You</span>
                    )}
                  </div>
                  <p className="text-[13px] text-on-surface-variant mt-1">
                    {emp.designation ?? 'No designation'} · {emp.department?.name ?? 'No department'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`chip border text-[11px] ${roleStyle.text} ${roleStyle.bg} ${roleStyle.border}`}>
                      <Shield size={9} />{emp.role.replace('_', ' ')}
                    </span>
                    <span className={`chip border text-[11px] ${
                      emp.status === 'ACTIVE' ? 'bg-success/10 text-success border-success/20'
                      : emp.status === 'INACTIVE' ? 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20'
                      : 'bg-error/10 text-error border-error/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${emp.status === 'ACTIVE' ? 'bg-success' : emp.status === 'INACTIVE' ? 'bg-on-surface-variant' : 'bg-error'}`} />
                      {emp.status}
                    </span>
                    <span className="chip border bg-on-surface-variant/8 text-on-surface-variant border-on-surface-variant/15 text-[11px]">
                      #{emp.employeeCode}
                    </span>
                  </div>
                </div>

                {/* Edit button */}
                {(isSelf || isAdmin) && (
                  <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-on-primary flex-shrink-0 transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #aa3000 0%, #c53800 100%)',
                      boxShadow: '0 2px 10px rgba(170,48,0,0.28)',
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Stats row — self only */}
            {((isSelf && !attendanceBlockedSelf) || (isAdmin && !isSelf)) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(isSelf ? [
                  { label: 'Attendance', value: attendancePct != null ? `${attendancePct.toFixed(1)}%` : '—', icon: 'fingerprint', accent: '#01677d', sub: stats ? `${stats.daysPresent}/${stats.totalWorkingDays} days` : 'This month' },
                  { label: 'Days Present', value: stats?.daysPresent != null ? String(stats.daysPresent) : '—', icon: 'how_to_reg', accent: '#059669', sub: 'This month' },
                  { label: 'Days on Leave', value: stats?.daysOnLeave != null ? String(stats.daysOnLeave) : '—', icon: 'event_available', accent: '#aa3000', sub: 'This month' },
                  { label: 'Days Absent', value: stats?.daysAbsent != null ? String(stats.daysAbsent) : '—', icon: 'event_busy', accent: '#ba1a1a', sub: 'This month' },
                ] : [
                  { label: 'Today', value: attendanceOverview?.today?.status ?? 'NO RECORD', icon: 'today', accent: '#01677d', sub: attendanceOverview?.period.month ?? 'Current month' },
                  { label: 'Late Frequency', value: employeeAttendance ? `${employeeAttendance.lateFrequency}%` : '-', icon: 'schedule', accent: '#aa3000', sub: employeeAttendance ? `${employeeAttendance.late} late arrivals` : 'Current month' },
                  { label: 'Leave Submitted', value: employeeLeave ? String(employeeLeave.submitted) : '-', icon: 'event_available', accent: '#7c4dff', sub: employeeLeave ? `${employeeLeave.pending} pending` : 'All requests' },
                  { label: 'Punctuality', value: employeeAttendance ? `${employeeAttendance.punctuality}%` : '-', icon: 'verified', accent: '#059669', sub: employeeAttendance ? `${employeeAttendance.attended} attended days` : 'Current month' },
                ]).map(s => (
                  <div key={s.label} className="glass-card rounded-2xl p-4 card-hover" style={{ borderLeft: `3px solid ${s.accent}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.accent}14` }}>
                      <span className="material-symbols-outlined text-[16px]" style={{ color: s.accent, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                    </div>
                    <div className="text-[20px] font-bold text-on-surface leading-none">{s.value}</div>
                    <div className="text-[11.5px] text-on-surface-variant mt-1">{s.label}</div>
                    <div className="text-[10.5px] text-on-surface-variant/50 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {isAdmin && !isSelf && (
              <div id="employee-attendance-status" className="space-y-4 scroll-mt-6">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-[14px] font-bold text-on-surface">Attendance Status</h2>
                      <p className="text-[11.5px] text-on-surface-variant mt-0.5">{attendanceOverview?.period.month ?? 'Current month'}</p>
                    </div>
                    <span className={`chip border ${attendanceOverview?.today?.status === 'LATE' ? 'bg-primary/10 text-primary border-primary/20' : attendanceOverview?.today ? 'bg-success/10 text-success border-success/20' : 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20'}`}>
                      Today: {attendanceOverview?.today?.status ?? 'NO RECORD'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      ['Present', employeeAttendance?.present ?? 0, '#059669'],
                      ['Late', employeeAttendance?.late ?? 0, '#aa3000'],
                      ['Half Day', employeeAttendance?.halfDay ?? 0, '#7c4dff'],
                      ['Leave', employeeAttendance?.leave ?? 0, '#01677d'],
                      ['Absent', employeeAttendance?.absent ?? 0, '#ba1a1a'],
                      ['WFH', employeeAttendance?.wfh ?? 0, '#1565c0'],
                    ].map(([label, value, color]) => (
                      <div key={String(label)} className="rounded-xl border border-card-border p-3 text-center">
                        <p className="text-[18px] font-black" style={{ color: String(color) }}>{String(value)}</p>
                        <p className="text-[10.5px] text-on-surface-variant mt-0.5">{String(label)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-card-border">
                    <table className="w-full min-w-[650px]">
                      <thead className="bg-surface-container-low">
                        <tr>
                          {['Date', 'Status', 'Punch In', 'Punch Out', 'Hours', 'Manual'].map(label => (
                            <th key={label} className="px-3 py-2 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border">
                        {(attendanceOverview?.records ?? []).slice(0, 15).map(record => (
                          <tr key={record.id}>
                            <td className="px-3 py-2.5 text-[12px] text-on-surface">{fmtDate(record.date)}</td>
                            <td className="px-3 py-2.5"><span className="chip border bg-surface-container text-on-surface border-card-border">{record.status}</span></td>
                            <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{record.punchInTime ? new Date(record.punchInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{record.punchOutTime ? new Date(record.punchOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{record.workingHours ?? '-'}</td>
                            <td className="px-3 py-2.5 text-[12px] text-on-surface-variant">{record.isManualPunch ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(attendanceOverview?.records ?? []).length === 0 && (
                      <div className="p-5 text-center text-[12px] text-on-surface-variant">No attendance records this month.</div>
                    )}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-[14px] font-bold text-on-surface">Leave Status</h2>
                      <p className="text-[11.5px] text-on-surface-variant mt-0.5">Submitted and reviewed leave requests</p>
                    </div>
                    <div className="flex gap-2 text-[10.5px] font-semibold">
                      <span className="chip border bg-primary/10 text-primary border-primary/20">{employeeLeave?.pending ?? 0} pending</span>
                      <span className="chip border bg-success/10 text-success border-success/20">{employeeLeave?.approved ?? 0} approved</span>
                      <span className="chip border bg-error/10 text-error border-error/20">{employeeLeave?.rejected ?? 0} rejected</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {(leaveOverview?.requests ?? []).slice(0, 10).map(request => (
                      <div key={request.id} className="rounded-xl border border-card-border px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-[12.5px] font-semibold text-on-surface">{request.leaveType} · {request.totalDays} day{request.totalDays === 1 ? '' : 's'}</p>
                          <p className="text-[11.5px] text-on-surface-variant mt-0.5">{fmtDate(request.fromDate)} to {fmtDate(request.toDate)} · {request.reason}</p>
                        </div>
                        <span className={`chip border ${request.status === 'APPROVED' ? 'bg-success/10 text-success border-success/20' : request.status === 'REJECTED' ? 'bg-error/10 text-error border-error/20' : 'bg-primary/10 text-primary border-primary/20'}`}>{request.status}</span>
                      </div>
                    ))}
                    {(leaveOverview?.requests ?? []).length === 0 && (
                      <div className="p-4 text-center text-[12px] text-on-surface-variant">No leave requests submitted.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Two-column detail layout */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
              <div className="space-y-4">

                {/* Contact */}
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-[13px] font-bold text-on-surface tracking-tight">Contact Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<Mail size={14} />}  label="Email"             value={emp.email} />
                    <InfoRow icon={<Phone size={14} />} label="Phone"             value={emp.phone} />
                    <InfoRow icon={<MapPin size={14} />} label="Address"          value={emp.address} />
                    <InfoRow icon={<User size={14} />}  label="Emergency Contact" value={emp.emergencyContact} />
                  </div>
                </div>

                {/* Work */}
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-[13px] font-bold text-on-surface tracking-tight">Work Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<Building2 size={14} />} label="Department"  value={emp.department?.name} />
                    <InfoRow icon={<User size={14} />}      label="Designation" value={emp.designation} />
                    <InfoRow icon={<User size={14} />}      label="Reporting Manager"
                      value={emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : null} />
                    <InfoRow icon={<Calendar size={14} />}  label="Joining Date" value={fmtDate(emp.joiningDate)} />
                    {(isSelf || isAdmin) && (
                      <InfoRow icon={<Shield size={14} />} label="Salary Grade" value={emp.salaryGrade} />
                    )}
                  </div>
                </div>

                {/* Approval chain */}
                {emp.approvalAuthority && emp.approvalAuthority.length > 0 && (
                  <div className="glass-card rounded-2xl p-5 space-y-3">
                    <h2 className="text-[13px] font-bold text-on-surface tracking-tight">Approval Authority</h2>
                    <div className="flex flex-col gap-2">
                      {emp.approvalAuthority.map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: '#aa3000' }}>{i + 1}</div>
                          <span className="text-[13px] text-on-surface font-medium">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Leave balance — self only */}
                {isSelf && balance.length > 0 && (
                  <div className="glass-card rounded-2xl p-5 space-y-4">
                    <h2 className="text-[13px] font-bold text-on-surface tracking-tight">Leave Balance</h2>
                    <div className="flex flex-col gap-3">
                      {balance.map(b => {
                        const color = LEAVE_COLOR[b.leaveType] ?? '#59413a';
                        const pct   = b.totalDays > 0 ? Math.round(((b.totalDays - b.usedDays) / b.totalDays) * 100) : 0;
                        return (
                          <div key={b.leaveType} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                <span className="text-[12.5px] font-semibold text-on-surface">{b.leaveType}</span>
                              </div>
                              <span className="text-[11.5px] font-bold" style={{ color }}>
                                {b.totalDays - b.usedDays} / {b.totalDays} left
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full" style={{ background: `${color}18` }}>
                              <div className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                <div className="glass-card rounded-2xl p-5 space-y-3">
                  <h2 className="text-[13px] font-bold text-on-surface tracking-tight">Quick Actions</h2>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Send Message',   icon: 'forum',           href: '/messaging-chat-hub',        accent: '#01677d' },
                      ...(!attendanceBlockedSelf ? [{ label: 'View Attendance', icon: 'fingerprint', href: isSelf ? '/attendance-punch-station' : isAdmin ? '#employee-attendance-status' : null, accent: '#aa3000' }] : []),
                      ...(isSelf ? [{ label: 'Apply for Leave', icon: 'event_available', href: '/leave-center', accent: '#059669' }] : []),
                    ].map(a => (
                      <button key={a.label}
                        onClick={() => {
                          if (!a.href) return;
                          if (a.href.startsWith('#')) {
                            document.querySelector(a.href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          } else {
                            router.push(a.href);
                          }
                        }}
                        disabled={!a.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ border: '1px solid rgba(226,191,181,0.3)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.accent}12` }}>
                          <span className="material-symbols-outlined text-[15px]" style={{ color: a.accent, fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                        </div>
                        {a.label}
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 ml-auto">chevron_right</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Edit drawer */}
      {showEdit && emp && (
        <EditDrawer
          emp={emp}
          onClose={() => setShowEdit(false)}
          onSaved={updated => setEmp(updated)}
        />
      )}

      {/* Photo modal */}
      {showPhoto && emp && (
        <PhotoModal
          currentUrl={emp.profilePhotoUrl}
          onClose={() => setShowPhoto(false)}
          onSaved={url => setEmp(prev => prev ? { ...prev, profilePhotoUrl: url || undefined } : prev)}
        />
      )}
    </>
  );
}
