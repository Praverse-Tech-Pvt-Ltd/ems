'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import type { Employee, OnboardingStatus } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft, Mail, Phone, Building2, User, Shield,
  Calendar, MessageSquare, Fingerprint,
  CheckCircle, XCircle, AlertTriangle, Briefcase,
  TrendingUp, MapPin, Clock, IndianRupee, ClipboardList,
  Award, BadgeCheck,
} from 'lucide-react';
import Link from 'next/link';

const AVATAR_COLORS = [
  { bg: 'bg-brutal-ink',    text: 'text-brutal-yellow' },
  { bg: 'bg-brutal-blue',   text: 'text-white' },
  { bg: 'bg-brutal-red',    text: 'text-white' },
  { bg: 'bg-brutal-yellow', text: 'text-brutal-ink' },
];

function avatarColor(id: string) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]!;
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="px-5 py-3.5 brutal-border-b bg-brutal-ink flex items-center gap-3">
      <Icon size={14} strokeWidth={2.5} className="text-brutal-yellow" />
      <span className="font-display font-extrabold text-[10px] tracking-[0.22em] text-white uppercase">
        {title}
      </span>
    </div>
  );
}

function InfoRow({
  icon: Icon, label, value, highlight = false,
}: {
  icon: React.ElementType; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3 brutal-border-b last:border-b-0">
      <div className={`w-8 h-8 grid place-items-center flex-shrink-0 ${highlight ? 'bg-brutal-yellow text-brutal-ink' : 'bg-brutal-ink text-brutal-yellow'}`}>
        <Icon size={13} strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <div className="section-label mb-0.5">{label}</div>
        <div className="font-display font-bold text-[13px] tracking-tight text-brutal-ink">{value || '—'}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`p-4 ${accent ? 'bg-brutal-yellow' : 'bg-brutal-cream'}`}>
      <div className="section-label mb-1">{label}</div>
      <div className="font-display font-extrabold text-2xl num leading-none">{value}</div>
    </div>
  );
}

function isIntern(employee: Employee) {
  return (
    employee.salaryGrade === 'INTERN' ||
    employee.designation?.toLowerCase().includes('intern')
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const me      = useAuthStore(s => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN' || me?.role === 'MANAGER';
  const isSelf  = me?.id === id;

  const { data: employee, isLoading, error } = useQuery<Employee & { manager?: Employee }>({
    queryKey: ['employee', id],
    queryFn: () => apiClient.get(`/employees/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: attendance } = useQuery<{ daysPresent: number; total: number } | null>({
    queryKey: ['attendance-stats', id],
    queryFn: () => apiClient.get(`/attendance/employee/${id}`).then(r => {
      const records = Array.isArray(r.data) ? r.data : [];
      const present = records.filter((rec: { status: string }) =>
        ['PRESENT', 'LATE', 'WFH', 'HALF_DAY'].includes(rec.status)
      ).length;
      return { daysPresent: present, total: records.length };
    }).catch(() => null),
    enabled: !!id && (isAdmin || isSelf),
  });

  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ['employee-onboarding', id],
    queryFn: () => apiClient.get(`/employees/${id}/onboarding`).then(r => r.data).catch(() => null),
    enabled: !!id && isAdmin,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6 animate-fade-up">
        <div className="h-10 w-48 skeleton" />
        <div className="h-48 skeleton brutal-border" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 skeleton brutal-border" />
          <div className="h-64 skeleton brutal-border" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="max-w-5xl animate-fade-up">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 font-display font-bold text-[11px] tracking-[0.2em] uppercase text-brutal-ink/60 hover:text-brutal-ink transition-colors mb-8"
        >
          <ArrowLeft size={14} /> BACK
        </button>
        <div className="brutal-border brutal-shadow p-12 text-center diag bg-brutal-cream">
          <div className="bg-brutal-cream inline-block px-6 py-4 brutal-border brutal-shadow">
            <AlertTriangle size={24} className="mx-auto mb-3 text-brutal-red" />
            <p className="font-display font-extrabold text-sm uppercase tracking-[0.2em]">Employee Not Found</p>
            <p className="section-label mt-1">This record may have been removed or you lack access.</p>
          </div>
        </div>
      </div>
    );
  }

  const av = avatarColor(employee.id);
  const statusOk = employee.status === 'ACTIVE';
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const sinceYear = employee.joiningDate ? new Date(employee.joiningDate).getFullYear() : '—';
  const intern = isIntern(employee);

  // Onboarding items to show — bank/aadhaar/pan are hidden from UI per policy
  const HIDDEN_ONBOARDING_KEYS = new Set(['BANK', 'AADHAAR', 'PAN']);
  const visibleOnboardingItems = onboarding?.requirements.filter(
    r => !HIDDEN_ONBOARDING_KEYS.has(r.key)
  ) ?? [];
  const onboardingVisible = visibleOnboardingItems.filter(r => r.complete).length;
  const onboardingTotal   = visibleOnboardingItems.length;

  return (
    <div className="max-w-5xl space-y-6 animate-fade-up">

      {/* ── Back nav ─── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 font-display font-bold text-[11px] tracking-[0.2em] uppercase text-brutal-ink/50 hover:text-brutal-ink transition-colors duration-fast"
      >
        <ArrowLeft size={13} strokeWidth={2.5} />
        BACK TO DIRECTORY
      </button>

      {/* ── Hero card ─── */}
      <div className="brutal-border brutal-shadow-lg bg-brutal-ink overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch">

          {/* Avatar */}
          <div
            className={`${av.bg} ${av.text} w-full sm:w-36 lg:w-44 flex-shrink-0 flex items-center justify-center brutal-border-r`}
            style={{ minHeight: '152px' }}
          >
            <span className="font-display font-extrabold text-[3.5rem] lg:text-[4.5rem] leading-none select-none">
              {employee.firstName[0]}{employee.lastName[0]}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 p-6 lg:p-8 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-display font-extrabold text-[10px] tracking-[0.2em] text-brutal-cream/50 uppercase">
                {employee.employeeCode}
              </span>
              {isSelf && (
                <span className="px-2 py-0.5 bg-brutal-yellow text-brutal-ink font-display font-extrabold text-[9px] tracking-[0.14em] uppercase border-2 border-brutal-yellow">
                  YOU
                </span>
              )}
              <span className={`px-2 py-0.5 font-display font-extrabold text-[9px] tracking-[0.14em] uppercase border-2 ${
                intern
                  ? 'border-brutal-blue/60 text-brutal-blue'
                  : 'border-brutal-cream/40 text-brutal-cream/70'
              }`}>
                {intern ? 'INTERN' : 'FULL-TIME'}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-none mb-1">
              {fullName}
            </h1>
            <p className="font-display font-bold text-[12px] tracking-[0.16em] text-brutal-cream/55 uppercase mb-4">
              {employee.designation ?? employee.role.replace(/_/g, ' ')}
              {employee.department?.name ? ` · ${employee.department.name}` : ''}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`flex items-center gap-1.5 px-3 py-1 border-2 font-display font-extrabold text-[10px] tracking-[0.14em] uppercase ${
                statusOk
                  ? 'bg-brutal-yellow border-brutal-yellow text-brutal-ink'
                  : 'bg-brutal-red border-brutal-red text-white'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusOk ? 'bg-brutal-ink animate-blink' : 'bg-white'}`} />
                {employee.status}
              </span>

              <span className="flex items-center gap-1.5 px-3 py-1 border-2 border-brutal-cream/30 font-display font-bold text-[10px] tracking-[0.14em] uppercase text-brutal-cream/60">
                <Calendar size={10} strokeWidth={2.5} />
                SINCE {sinceYear}
              </span>

              <span className={`flex items-center gap-1.5 px-3 py-1 border-2 font-display font-bold text-[10px] tracking-[0.14em] uppercase ${
                employee.faceEnrolled
                  ? 'border-brutal-cream/30 text-brutal-cream/60'
                  : 'border-brutal-red/50 text-brutal-red'
              }`}>
                <Fingerprint size={10} strokeWidth={2.5} />
                {employee.faceEnrolled ? 'FACE ENROLLED' : 'NO FACE ID'}
              </span>

              {onboarding && (
                <span className={`flex items-center gap-1.5 px-3 py-1 border-2 font-display font-bold text-[10px] tracking-[0.14em] uppercase ${
                  onboarding.completionPercent === 100
                    ? 'border-brutal-cream/30 text-brutal-cream/60'
                    : 'border-brutal-red/50 text-brutal-red'
                }`}>
                  <ClipboardList size={10} strokeWidth={2.5} />
                  ONBOARDING {onboarding.completionPercent}%
                </span>
              )}
            </div>
          </div>

          {/* Action column */}
          <div className="flex sm:flex-col justify-start items-stretch sm:w-14 brutal-border-l">
            {!isSelf && (
              <Link
                href={`/chat?dm=${employee.id}`}
                className="flex-1 sm:flex-none sm:h-14 flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-0 bg-brutal-yellow text-brutal-ink brutal-border-b hover:bg-brutal-cream transition-colors duration-fast"
                title="Send message"
              >
                <MessageSquare size={16} strokeWidth={2.5} />
                <span className="sm:hidden font-display font-extrabold text-[10px] tracking-[0.2em] uppercase ml-1">MSG</span>
              </Link>
            )}
            {isSelf && (
              <Link
                href="/profile"
                className="flex-1 sm:flex-none sm:h-14 flex items-center justify-center gap-2 sm:gap-0 px-4 sm:px-0 bg-brutal-yellow text-brutal-ink brutal-border-b hover:bg-brutal-cream transition-colors duration-fast"
                title="Edit profile"
              >
                <User size={16} strokeWidth={2.5} />
                <span className="sm:hidden font-display font-extrabold text-[10px] tracking-[0.2em] uppercase ml-1">EDIT</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ─── */}
      {(isAdmin || isSelf) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 brutal-border brutal-shadow">
          <StatBox label="STATUS" value={statusOk ? 'ACTIVE' : employee.status} accent={statusOk} />
          <div className="brutal-border-l">
            <StatBox label="SINCE" value={sinceYear} />
          </div>
          <div className="brutal-border-l">
            <StatBox label="DEPT" value={employee.department?.name?.toUpperCase() ?? '—'} />
          </div>
          <div className="brutal-border-l">
            <StatBox label="FACE ID" value={employee.faceEnrolled ? 'YES' : 'NO'} accent={employee.faceEnrolled} />
          </div>
        </div>
      )}

      {/* ── Main two-column layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Personal & Contact Info */}
        <section className="brutal-border brutal-shadow bg-brutal-cream">
          <SectionHeader icon={User} title="Personal Information" />
          <div className="px-5 py-2">
            <InfoRow icon={Mail}      label="Corporate Email"  value={employee.email} />
            <InfoRow icon={Phone}     label="Phone"            value={employee.phone ?? 'To be collected'} />
            <InfoRow icon={MapPin}    label="Location / Address" value={employee.address ?? 'To be collected'} />
            {(isAdmin || isSelf) && (
              <InfoRow icon={Phone} label="Emergency Contact" value={employee.emergencyContact ?? 'To be collected'} highlight />
            )}
          </div>
        </section>

        {/* Right — Employment Details */}
        <section className="brutal-border brutal-shadow bg-brutal-cream">
          <SectionHeader icon={Briefcase} title="Employment Details" />
          <div className="px-5 py-2">
            <InfoRow icon={Award}     label="Employee Type"    value={intern ? 'Intern' : 'Full-time Employee'} />
            <InfoRow icon={Building2} label="Department"       value={employee.department?.name ?? '—'} />
            <InfoRow icon={Briefcase} label="Designation"      value={employee.designation ?? '—'} />
            <InfoRow icon={Shield}    label="System Role"      value={employee.role.replace(/_/g, ' ')} />
            <InfoRow icon={Calendar}  label="Date of Joining"  value={formatDate(employee.joiningDate)} />
            <InfoRow
              icon={User}
              label="Reporting Manager"
              value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
            />
          </div>
        </section>
      </div>

      {/* ── Compensation (admin only, no bank/aadhaar/pan) ─── */}
      {isAdmin && (
        <section className="brutal-border brutal-shadow bg-brutal-cream">
          <SectionHeader icon={IndianRupee} title="Compensation" />
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-[3px] sm:divide-y-0 sm:divide-x-[3px] divide-brutal-ink">
            <div className="p-5">
              <div className="section-label mb-1">TYPE</div>
              <div className="font-display font-extrabold text-xl tracking-tight">
                {intern ? 'STIPEND' : 'FIXED SALARY'}
              </div>
            </div>
            <div className="p-5">
              <div className="section-label mb-1">GRADE</div>
              <div className="font-display font-extrabold text-xl tracking-tight">
                {employee.salaryGrade ?? (intern ? 'INTERN' : '—')}
              </div>
            </div>
            <div className="p-5">
              <div className="section-label mb-1">GROSS / MONTH</div>
              <div className="font-display font-extrabold text-xl tracking-tight">
                {employee.grossSalary
                  ? `₹ ${Number(employee.grossSalary).toLocaleString('en-IN')}`
                  : '—'}
              </div>
            </div>
          </div>
          <div className="px-5 py-3 brutal-border-t bg-brutal-surface">
            <p className="font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/50 uppercase">
              Bank account, Aadhaar &amp; PAN details are managed securely in onboarding — not shown here.
            </p>
          </div>
        </section>
      )}

      {/* ── Attendance + Onboarding row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Attendance */}
        {(isAdmin || isSelf) && (
          <section className="brutal-border brutal-shadow bg-brutal-cream">
            <SectionHeader icon={Clock} title="Attendance (this month)" />
            <div className="p-5">
              {attendance ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="brutal-border p-4 bg-brutal-yellow">
                    <div className="section-label mb-1">Days Present</div>
                    <div className="font-display font-extrabold text-3xl num leading-none">
                      {attendance?.daysPresent ?? 0}
                    </div>
                  </div>
                  <div className="brutal-border p-4">
                    <div className="section-label mb-1">Records</div>
                    <div className="font-display font-extrabold text-3xl num leading-none">
                      {attendance?.total ?? 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <div className="section-label">No attendance records yet.</div>
                </div>
              )}
              <Link
                href={`/attendance${isSelf ? '' : `?employee=${employee.id}`}`}
                className="mt-4 flex items-center justify-between w-full brutal-border brutal-btn-ghost px-4 py-2.5 text-left group"
              >
                <span className="font-display font-bold text-[11px] tracking-[0.18em] uppercase">
                  View Full Attendance
                </span>
                <TrendingUp size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform duration-fast" />
              </Link>
            </div>
          </section>
        )}

        {/* Onboarding checklist (admin, bank/aadhaar/pan items hidden) */}
        {isAdmin && onboarding && visibleOnboardingItems.length > 0 && (
          <section className="brutal-border brutal-shadow bg-brutal-cream">
            <SectionHeader icon={ClipboardList} title={`Onboarding Checklist · ${onboardingVisible}/${onboardingTotal}`} />
            <div className="px-5 py-3 divide-y-[2px] divide-brutal-ink/10">
              {visibleOnboardingItems.map(item => (
                <div key={item.key} className="flex items-center gap-3 py-2.5">
                  {item.complete
                    ? <CheckCircle size={14} strokeWidth={2.5} className="text-[#0F8F3A] flex-shrink-0" />
                    : <XCircle    size={14} strokeWidth={2.5} className="text-brutal-red flex-shrink-0" />
                  }
                  <span className={`font-display font-bold text-[11px] tracking-[0.12em] uppercase ${
                    item.complete ? 'text-brutal-ink' : 'text-brutal-red'
                  }`}>
                    {item.label}
                  </span>
                  {!item.complete && (
                    <span className="ml-auto font-display font-bold text-[9px] tracking-[0.16em] text-brutal-red/70 uppercase">
                      PENDING
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 brutal-border-t">
              <div className="w-full h-2 bg-brutal-ink/10 brutal-border">
                <div
                  className="h-full bg-brutal-yellow transition-all duration-300"
                  style={{ width: `${Math.round((onboardingVisible / Math.max(onboardingTotal, 1)) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/50 uppercase">
                {Math.round((onboardingVisible / Math.max(onboardingTotal, 1)) * 100)}% complete (sensitive docs excluded)
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Approval Authority ─── */}
      {!!employee.approvalAuthority?.length && (
        <section className="brutal-border brutal-shadow bg-brutal-cream">
          <SectionHeader icon={Shield} title="Approval Authority" />
          <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y-[2px] sm:divide-y-0 divide-brutal-ink/10">
            {employee.approvalAuthority.map((auth, i) => (
              <div
                key={auth}
                className={`flex items-center gap-3 py-3 ${
                  i % 2 === 0 && i + 1 < employee.approvalAuthority!.length ? 'sm:brutal-border-r' : ''
                }`}
              >
                <BadgeCheck size={14} strokeWidth={2.5} className="text-brutal-blue flex-shrink-0" />
                <span className="font-display font-bold text-[11px] tracking-[0.10em] text-brutal-ink leading-tight">
                  {auth}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Actions ─── */}
      <section className="brutal-border brutal-shadow bg-brutal-cream">
        <SectionHeader icon={Briefcase} title="Quick Actions" />
        <div className="divide-y-[3px] divide-brutal-ink">
          {!isSelf && (
            <Link
              href={`/chat?dm=${employee.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-brutal-yellow transition-colors duration-fast group"
            >
              <MessageSquare size={14} strokeWidth={2.5} />
              <span className="font-display font-bold text-[12px] tracking-tight flex-1">Send Direct Message</span>
              <ArrowLeft size={12} strokeWidth={2.5} className="rotate-180 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-fast" />
            </Link>
          )}
          {isSelf && (
            <Link
              href="/profile"
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-brutal-yellow transition-colors duration-fast group"
            >
              <User size={14} strokeWidth={2.5} />
              <span className="font-display font-bold text-[12px] tracking-tight flex-1">Edit My Profile</span>
              <ArrowLeft size={12} strokeWidth={2.5} className="rotate-180 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-fast" />
            </Link>
          )}
          <Link
            href="/employees"
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-brutal-surface transition-colors duration-fast group"
          >
            <Building2 size={14} strokeWidth={2.5} />
            <span className="font-display font-bold text-[12px] tracking-tight flex-1">Browse Directory</span>
            <ArrowLeft size={12} strokeWidth={2.5} className="rotate-180 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-fast" />
          </Link>
          {(isAdmin || isSelf) && (
            <Link
              href={`/attendance${isSelf ? '' : `?employee=${employee.id}`}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-brutal-surface transition-colors duration-fast group"
            >
              <Clock size={14} strokeWidth={2.5} />
              <span className="font-display font-bold text-[12px] tracking-tight flex-1">View Attendance Log</span>
              <ArrowLeft size={12} strokeWidth={2.5} className="rotate-180 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-fast" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
