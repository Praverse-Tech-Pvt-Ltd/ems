'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import type { Employee } from '@/types';

type OnboardingRequirement = {
  key: string;
  label: string;
  complete: boolean;
};

type OnboardingStatus = {
  completionPercent: number;
  requirements: OnboardingRequirement[];
};

import { formatDate, formatCurrency, formatTime } from '@/lib/utils';
import {
  ArrowLeft, Mail, Phone, Building2, User, Shield,
  Calendar, MessageSquare, Fingerprint,
  CheckCircle, XCircle, AlertTriangle, Briefcase,
  TrendingUp, MapPin, Clock, IndianRupee, ClipboardList,
  Award, BadgeCheck, Star, Zap, Plane, Coffee, Receipt, Heart, CreditCard, Package, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

type ProfileExtra = {
  summary: string;
  workMode: string;
  workLocation: string;
  responsibilities: string[];
  skills: string[];
  achievements?: string[];
};

const PROFILE_EXTRAS: Record<string, ProfileExtra> = {
  'NEX-QA-001': {
    summary: 'Detail-oriented QA Chemist with 3+ years of experience in pharmaceutical Quality Assurance, GMP documentation, BMR/BPR review, plant compliance, audit support, and regulatory standards.',
    workMode: 'On-site',
    workLocation: 'NexGen Pharma Solutions Office, Vadodara, Gujarat',
    responsibilities: [
      'Batch Manufacturing & Packaging Record (BMR/BPR) review for GMP compliance',
      'Equipment cleaning record review and SOP adherence verification',
      'Plant round inspections and GMP compliance monitoring',
      'Documentation control — SOP issuance, version control, APQR preparation',
      'Deviation, OOS/OOT, and complaint data collection',
    ],
    skills: [
      'GMP Documentation Handling',
      'BMR/BPR Review',
      'APQR Support',
      'Deviation & Compliance Handling',
      'Instrument Calibration (pH meter, Karl Fischer, UV, polarimeter)',
      'Microsoft Word, Excel, PowerPoint',
    ],
    achievements: [
      'Part of QA team for successful ANVISA, USFDA, Korea & EU-GMP regulatory audit clearances at Ami Lifesciences Pvt. Ltd.',
    ],
  },
  'NEX-SW-INT-001': {
    summary: 'Software Development Intern in Robotics & Intelligent Systems. Focused on modular software development, logic implementation, and applied AI for intelligent automation.',
    workMode: 'On-site only (No hybrid / No WFH)',
    workLocation: 'NexGen Pharma Solutions Office, Vadodara, Gujarat',
    responsibilities: [
      'Software development and integration for intelligent and automated systems',
      'Modular component work — logic implementation, system workflows, optimization',
      'Testing, debugging, and documentation of software components',
      'Collaboration with internal technical team under supervision',
      'Project domain: Intelligent Robotic Systems, digital automation, applied AI',
    ],
    skills: [
      'Software Development',
      'Logic Implementation',
      'Testing & Debugging',
      'Applied Artificial Intelligence',
      'System Workflows',
    ],
  },
  'NEX-SW-INT-002': {
    summary: 'Software Development Intern in Robotics & Intelligent Systems. Focused on modular software development, logic implementation, and applied AI for intelligent automation.',
    workMode: 'On-site only (No hybrid / No WFH)',
    workLocation: 'NexGen Pharma Solutions Office, Vadodara, Gujarat',
    responsibilities: [
      'Software development and integration for intelligent and automated systems',
      'Modular component work — logic implementation, system workflows, optimization',
      'Testing, debugging, and documentation of software components',
      'Collaboration with internal technical team under supervision',
      'Project domain: Intelligent Robotic Systems, digital automation, applied AI',
    ],
    skills: [
      'Software Development',
      'Logic Implementation',
      'Testing & Debugging',
      'Applied Artificial Intelligence',
      'System Workflows',
    ],
  },
  'NEX-RA-001': {
    summary: 'Regulatory Affairs Officer supporting dossier preparation, regulatory submissions, and compliance activities for pharmaceutical products.',
    workMode: 'On-site / Hybrid (as per project requirement)',
    workLocation: 'Vadodara or as assigned based on business needs',
    responsibilities: [
      'Regulatory affairs documentation and compliance support',
      'Preparation, review, and compilation of regulatory dossiers',
      'Regulatory submissions coordination and follow-up',
      'Liaison with internal QA/QC and external regulatory bodies',
      'Maintaining regulatory tracking databases and submission timelines',
    ],
    skills: [
      'Regulatory Dossier Preparation',
      'Regulatory Submissions',
      'Pharmaceutical Compliance',
      'Documentation Management',
      'Cross-functional Coordination',
    ],
  },
};

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

function statusTone(s: string): string {
  if (s === 'APPROVED' || s === 'PAID')            return 'ok';
  if (s === 'FINANCE_REVIEW' || s === 'L1_REVIEW') return 'info';
  if (s === 'SUBMITTED' || s === 'DRAFT')           return 'hold';
  if (s === 'REJECTED')                             return 'red';
  return 'hold';
}

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

const STATUS_LABEL: Record<string, string> = {
  DRAFT:          'DRAFT',
  SUBMITTED:      'AWAITING MANAGER',
  L1_REVIEW:      'MANAGER REVIEW',
  FINANCE_REVIEW: 'UNDER FINANCE REVIEW',
  APPROVED:       'APPROVED',
  REJECTED:       'REJECTED',
  PAID:           'PAID',
};

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-[#0F8F3A] text-white',
  LATE: 'bg-brutal-blue text-white',
  HALF_DAY: 'bg-brutal-yellow text-brutal-ink',
  WFH: 'bg-purple-600 text-white',
  ABSENT: 'bg-brutal-red text-white',
  LEAVE: 'bg-orange-500 text-white',
  HOLIDAY: 'bg-teal-600 text-white',
};

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
  // Any admin/manager can view any employee. Employees can only view themselves.
  const canViewEmployee = isAdmin || isSelf;

  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'expenses'>('overview');

  const { data: employee, isLoading, error } = useQuery<Employee & { manager?: Employee }>({
    queryKey: ['employee', id],
    queryFn: () => apiClient.get(`/employees/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: attendance } = useQuery<{ daysPresent: number; total: number } | null>({
    queryKey: ['attendance-stats', id],
    queryFn: () => {
      // Employees must use /my — /employee/:id requires MANAGER+ role
      const url = isSelf ? '/attendance/my' : `/attendance/employee/${id}`;
      return apiClient.get(url).then(r => {
        const records = Array.isArray(r.data) ? r.data : [];
        const present = records.filter((rec: { status: string }) =>
          ['PRESENT', 'LATE', 'WFH', 'HALF_DAY'].includes(rec.status)
        ).length;
        return { daysPresent: present, total: records.length };
      }).catch(() => null);
    },
    enabled: !!id && canViewEmployee,
  });

  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ['employee-onboarding', id],
    queryFn: () => apiClient.get(`/employees/${id}/onboarding`).then(r => r.data).catch(() => null),
    enabled: !!id && isAdmin,
  });

  const { data: attendanceRecords = [], isLoading: isLoadingAttendanceRecords } = useQuery<any[]>({
    queryKey: ['employee-attendance-records', id],
    queryFn: () => {
      const url = isSelf ? '/attendance/my' : `/attendance/employee/${id}`;
      return apiClient.get(url).then(r => Array.isArray(r.data) ? r.data : []);
    },
    enabled: !!id && canViewEmployee,
  });

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<any[]>({
    queryKey: ['employee-expenses', id],
    queryFn: () => {
      const url = isSelf ? '/expenses/my' : `/expenses?employeeId=${id}`;
      return apiClient.get(url).then(r => Array.isArray(r.data) ? r.data : []);
    },
    enabled: !!id && canViewEmployee,
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

  const profileExtra = PROFILE_EXTRAS[employee.employeeCode] ?? null;
  const av = avatarColor(employee.id);
  const statusOk = employee.status === 'ACTIVE';
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const sinceYear = employee.joiningDate ? new Date(employee.joiningDate).getFullYear() : '—';
  const intern = isIntern(employee);

  // Onboarding items to show — bank/aadhaar/pan are hidden from UI per policy
  const HIDDEN_ONBOARDING_KEYS = new Set(['BANK', 'AADHAAR', 'PAN']);
  const visibleOnboardingItems = onboarding?.requirements.filter(
    (r: OnboardingRequirement) => !HIDDEN_ONBOARDING_KEYS.has(r.key)
  ) ?? [];
  const onboardingVisible = visibleOnboardingItems.filter((r: OnboardingRequirement) => r.complete).length;
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

      {/* ── Tabs header ─── */}
      {(isAllowedAdmin || isSelf) && (
        <div className="flex flex-wrap items-center gap-2 brutal-border-b pb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`font-display font-bold text-[11px] tracking-[0.16em] px-4 py-2.5 border-2 border-brutal-ink inline-flex items-center gap-2 transition-all
              ${activeTab === 'overview' ? 'bg-brutal-ink text-brutal-yellow brutal-shadow-sm -translate-x-0.5 -translate-y-0.5' : 'bg-brutal-cream hover:bg-brutal-yellow/30'}`}
          >
            <User size={13} strokeWidth={2.5} />
            PROFILE OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`font-display font-bold text-[11px] tracking-[0.16em] px-4 py-2.5 border-2 border-brutal-ink inline-flex items-center gap-2 transition-all
              ${activeTab === 'attendance' ? 'bg-brutal-ink text-brutal-yellow brutal-shadow-sm -translate-x-0.5 -translate-y-0.5' : 'bg-brutal-cream hover:bg-brutal-yellow/30'}`}
          >
            <Clock size={13} strokeWidth={2.5} />
            ATTENDANCE LOGS
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`font-display font-bold text-[11px] tracking-[0.16em] px-4 py-2.5 border-2 border-brutal-ink inline-flex items-center gap-2 transition-all
              ${activeTab === 'expenses' ? 'bg-brutal-ink text-brutal-yellow brutal-shadow-sm -translate-x-0.5 -translate-y-0.5' : 'bg-brutal-cream hover:bg-brutal-yellow/30'}`}
          >
            <IndianRupee size={13} strokeWidth={2.5} />
            EXPENSE CLAIMS
          </button>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
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
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="mt-4 flex items-center justify-between w-full brutal-border brutal-btn-ghost px-4 py-2.5 text-left group"
                  >
                    <span className="font-display font-bold text-[11px] tracking-[0.18em] uppercase">
                      View Full Attendance Logs
                    </span>
                    <TrendingUp size={13} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform duration-fast" />
                  </button>
                </div>
              </section>
            )}

            {/* Onboarding checklist (admin, bank/aadhaar/pan items hidden) */}
            {isAdmin && onboarding && visibleOnboardingItems.length > 0 && (
              <section className="brutal-border brutal-shadow bg-brutal-cream">
                <SectionHeader icon={ClipboardList} title={`Onboarding Checklist · ${onboardingVisible}/${onboardingTotal}`} />
                <div className="px-5 py-3 divide-y-[2px] divide-brutal-ink/10">
                  {visibleOnboardingItems.map((item: OnboardingRequirement) => (
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

          {/* ── Work Details + Responsibilities (from profile data) ─── */}
          {profileExtra && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Work Info */}
                <section className="brutal-border brutal-shadow bg-brutal-cream">
                  <SectionHeader icon={MapPin} title="Work Details" />
                  <div className="px-5 py-2">
                    <InfoRow icon={MapPin}    label="Work Location" value={profileExtra.workLocation} />
                    <InfoRow icon={Briefcase} label="Work Mode"     value={profileExtra.workMode} />
                  </div>
                  <div className="px-5 py-4 brutal-border-t bg-brutal-surface">
                    <p className="font-display font-bold text-[10px] uppercase tracking-widest text-brutal-ink/50 mb-1">Summary</p>
                    <p className="font-body text-xs text-brutal-ink/80 leading-relaxed">{profileExtra.summary}</p>
                  </div>
                </section>

                {/* Skills */}
                <section className="brutal-border brutal-shadow bg-brutal-cream">
                  <SectionHeader icon={Zap} title="Key Skills" />
                  <div className="px-5 py-4 flex flex-wrap gap-2">
                    {profileExtra.skills.map((skill) => (
                      <span key={skill} className="px-3 py-1.5 brutal-border bg-brutal-yellow font-display font-bold text-[10px] uppercase tracking-wide">
                        {skill}
                      </span>
                    ))}
                  </div>
                  {profileExtra.achievements && profileExtra.achievements.length > 0 && (
                    <div className="px-5 py-4 brutal-border-t">
                      <p className="font-display font-bold text-[10px] uppercase tracking-widest text-brutal-ink/50 mb-2 flex items-center gap-1.5">
                        <Star size={11} /> Achievements
                      </p>
                      {profileExtra.achievements.map((ach, i) => (
                        <div key={i} className="flex items-start gap-2 mt-1.5">
                          <span className="w-1.5 h-1.5 bg-brutal-ink flex-shrink-0 mt-1.5" />
                          <p className="font-body text-xs text-brutal-ink/80 leading-relaxed">{ach}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Responsibilities */}
              <section className="brutal-border brutal-shadow bg-brutal-cream">
                <SectionHeader icon={ClipboardList} title="Key Responsibilities" />
                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                  {profileExtra.responsibilities.map((resp, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 brutal-border-b last:border-b-0">
                      <span className="font-display font-extrabold text-brutal-ink/30 text-[13px] w-5 flex-shrink-0 leading-none mt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className="font-display font-bold text-[11px] tracking-[0.06em] text-brutal-ink leading-snug">{resp}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
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
                  <span className="font-display font-bold text-[12px] tracking-tight flex-1">View Full Attendance Page</span>
                  <ArrowLeft size={12} strokeWidth={2.5} className="rotate-180 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-fast" />
                </Link>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <section className="brutal-border brutal-shadow bg-brutal-cream">
            <SectionHeader icon={Clock} title="Attendance Logs" />
            
            {isLoadingAttendanceRecords ? (
              <div className="p-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                LOADING ATTENDANCE LOGS…
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="p-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                NO ATTENDANCE RECORDS FOUND
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="brutal-border-b bg-brutal-ink text-white font-display font-bold text-[10px] tracking-[0.2em] uppercase">
                      <th className="p-4">DATE</th>
                      <th className="p-4">PUNCH IN</th>
                      <th className="p-4">PUNCH OUT</th>
                      <th className="p-4 text-center">WORKING HOURS</th>
                      <th className="p-4">LOCATION (IN / OUT)</th>
                      <th className="p-4 text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[2px] divide-brutal-ink/10 font-display font-bold text-[12px] tracking-tight">
                    {attendanceRecords.map((r) => {
                      const statusColor = ATTENDANCE_STATUS_COLORS[r.status] ?? 'bg-brutal-surface text-brutal-ink';
                      const workedHours = r.workingHours ? Number(r.workingHours) : 0;
                      return (
                        <tr key={r.id} className="hover:bg-brutal-yellow/5 transition-colors border-b brutal-border-b">
                          <td className="p-4 num">{formatDate(r.date)}</td>
                          <td className="p-4">
                            {r.punchInTime ? (
                              <div className="flex flex-col">
                                <span className="num text-[13px]">{formatTime(r.punchInTime)}</span>
                                {r.isManualPunch && (
                                  <span className="text-[9px] text-brutal-blue uppercase tracking-wider">MANUAL PUNCH</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-brutal-ink/45">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            {r.punchOutTime ? (
                              <span className="num text-[13px]">{formatTime(r.punchOutTime)}</span>
                            ) : (
                              <span className="text-brutal-ink/45">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {workedHours > 0 ? (
                              <div className="inline-flex flex-col items-center gap-1 min-w-[70px]">
                                <span className="num text-[13px]">{workedHours.toFixed(1)}h</span>
                                <div className="w-16 h-1.5 border border-brutal-ink bg-brutal-surface rounded-none overflow-hidden">
                                  <div
                                    className={`h-full ${workedHours >= 8 ? 'bg-[#0F8F3A]' : workedHours >= 4 ? 'bg-brutal-blue' : 'bg-brutal-red'}`}
                                    style={{ width: `${Math.min(100, (workedHours / 9) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-brutal-ink/45">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5 text-[11px] text-brutal-ink/75 uppercase tracking-wide">
                              <span>IN: {r.isGeoValidIn ? '✅ OFFICE' : '🏡 REMOTE'}</span>
                              {r.punchOutTime && (
                                <span>OUT: {r.isGeoValidOut ? '✅ OFFICE' : '🏡 REMOTE'}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`px-2.5 py-1 text-[10px] uppercase border-2 border-brutal-ink font-display font-extrabold tracking-wider inline-block ${statusColor}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <section className="brutal-border brutal-shadow bg-brutal-cream">
            <SectionHeader icon={IndianRupee} title="Expense Claims" />
            
            {isLoadingExpenses ? (
              <div className="p-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                LOADING EXPENSES…
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
                NO EXPENSES SUBMITTED BY THIS EMPLOYEE
              </div>
            ) : (
              <div className="divide-y-[3px] divide-brutal-surface">
                {expenses.map((e, idx) => {
                  const tone = statusTone(e.status);
                  const Icon = CATEGORY_ICON[e.category] ?? Package;
                  const label = CATEGORY_LABEL[e.category] ?? e.category;
                  const statusLabel = STATUS_LABEL[e.status] ?? e.status;
                  return (
                    <div
                      key={e.id}
                      className="grid grid-cols-12 items-stretch hover:bg-brutal-yellow/5 transition-colors border-b brutal-border-b"
                    >
                      <div className={`col-span-12 sm:col-span-1 ${ACCENT[tone] ?? 'bg-brutal-surface'} grid place-items-center sm:brutal-border-r brutal-border-b sm:border-b-0 py-4`}>
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
                        {e.rejectionReason && (
                          <div className="mt-1 text-[10px] font-display font-bold text-brutal-red uppercase tracking-wide">
                            REASON: {e.rejectionReason}
                          </div>
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center">
                        <span className="font-display font-bold text-[12px] tracking-[0.12em] num">{formatDate(e.expenseDate)}</span>
                      </div>
                      <div className="col-span-6 sm:col-span-2 px-5 py-3 sm:brutal-border-r flex items-center justify-end">
                        <span className="text-[17px] font-bold num tracking-tight">{formatCurrency(e.amount)}</span>
                      </div>
                      <div className="col-span-12 sm:col-span-2 px-3 py-3 flex items-center justify-end gap-2">
                        <span className={`font-display font-bold inline-flex items-center px-2 py-[3px] text-[10px] tracking-[0.12em] uppercase border-2 border-brutal-ink ${TONE_TAG[tone] ?? 'bg-brutal-surface text-brutal-ink'}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
