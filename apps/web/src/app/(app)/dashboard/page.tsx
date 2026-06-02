'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { DashboardStats, AttendanceRecord, LeaveBalance, Notification, AttendanceStats } from '@/types';
import {
  Fingerprint, CheckCircle, AlertTriangle, DollarSign,
  Calendar, Wifi, MapPin, ArrowRight, ArrowUp, ArrowDown, Bell, ChevronRight,
  Camera, UserCheck,
} from 'lucide-react';
import type { LeaveRequest } from '@/types';
import Link from 'next/link';
import { PunchModal } from '@/components/PunchModal';

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Sparkline({ data, color = '#1a1a1a' }: { data: number[]; color?: string }) {
  const w = 80, h = 26, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      {pts.map(([x, y], i) => <rect key={i} x={(x ?? 0) - 1.5} y={(y ?? 0) - 1.5} width="3" height="3" fill={color} />)}
    </svg>
  );
}

const TONE_CLASS: Record<string, string> = {
  ok:   'bg-[#0F8F3A] text-white',
  info: 'bg-brutal-blue text-white',
  hold: 'bg-brutal-yellow text-brutal-ink',
  mute: 'bg-brutal-surface text-brutal-ink',
  red:  'bg-brutal-red text-white',
};

function notifTone(type: string, isRead: boolean): string {
  if (isRead) return 'mute';
  const t = type.toUpperCase();
  if (t.includes('APPROV') || t.includes('PAID') || t.includes('SUCCESS')) return 'ok';
  if (t.includes('PUNCH') || t.includes('SALARY') || t.includes('SLIP'))   return 'info';
  if (t.includes('LEAVE') || t.includes('REQUEST') || t.includes('PENDING')) return 'hold';
  return 'mute';
}

function notifKind(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('EXPENSE') || t.includes('INVOICE')) return 'EXP';
  if (t.includes('PUNCH') || t.includes('ATTEND'))    return 'IN';
  if (t.includes('LEAVE'))                             return 'LV';
  if (t.includes('SALARY') || t.includes('PAYROLL'))  return 'PAY';
  if (t.includes('POLICY') || t.includes('SYSTEM'))   return 'SYS';
  return 'REQ';
}

// Build a fake sparkline from a single current value (flat or slight trend)
function flatSpark(value: number, len = 7): number[] {
  return Array.from({ length: len }, (_, i) => Math.max(0, value - (len - 1 - i) * 0.5));
}

export default function DashboardPage() {
  const user  = useAuthStore((s) => s.user);
  const clock = useClock();
  const [punchModal, setPunchModal] = useState<'in' | 'out' | null>(null);
  const [punchManual, setPunchManual] = useState(false);
  const time  = clock ? clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  const secs  = clock ? String(clock.getSeconds()).padStart(2, '0') : '00';
  const date  = clock ? clock.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase() : 'LOADING...';

  const { data: me } = useQuery<{ faceEnrolled: boolean }>({
    queryKey: ['me-face'],
    queryFn:  () => apiClient.get('/employees/me').then((r) => r.data).catch(() => null),
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn:  () => apiClient.get('/dashboard/stats').then((r) => r.data),
  });

  const { data: todayRecord } = useQuery<AttendanceRecord | null>({
    queryKey: ['attendance-today'],
    queryFn:  () => apiClient.get('/attendance/today').then((r) => r.data).catch(() => null),
  });

  const { data: myLeaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['my-leaves-dashboard'],
    queryFn:  () => apiClient.get('/leaves/my').then((r) => r.data).catch(() => []),
  });

  const { data: recentActivity = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-recent'],
    queryFn:  () => apiClient.get('/attendance/my?limit=5').then((r) => r.data).catch(() => []),
  });

  const { data: weekAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-week'],
    queryFn:  () => apiClient.get('/attendance/my?limit=7').then((r) => r.data).catch(() => []),
  });

  const { data: attendanceStats } = useQuery<AttendanceStats>({
    queryKey: ['attendance-stats'],
    queryFn:  () => apiClient.get('/attendance/my/stats').then((r) => r.data).catch(() => null),
  });

  const { data: leaveBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances'],
    queryFn:  () => apiClient.get('/leaves/balance').then((r) => r.data).catch(() => []),
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn:  () => apiClient.get('/notifications').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  });

  // ── KPI values from live data ─────────────────────────────────────────────
  const leavesAvailable = leaveBalances.reduce((s, b) => s + (b.totalDays - b.usedDays), 0);
  const pendingApprovals = (stats?.pendingLeaves ?? 0) + (stats?.pendingExpenses ?? 0);
  const hoursThisWeek = weekAttendance.reduce((s, r) => s + Number(r.workingHours ?? 0), 0);

  const attendancePct = attendanceStats?.attendancePercent ?? 0;

  const kpis = useMemo(() => [
    {
      label: 'LEAVES AVAILABLE', value: leavesAvailable, unit: 'DAYS',
      trend: 0, dir: 'down' as const,
      spark: flatSpark(leavesAvailable), accent: 'yellow',
      sub: null,
    },
    {
      label: 'PENDING APPROVALS', value: pendingApprovals, unit: 'ITEMS',
      trend: 0, dir: 'up' as const,
      spark: flatSpark(pendingApprovals), accent: 'red',
      sub: null,
    },
    {
      label: 'ATTENDANCE · MTD', value: attendancePct, unit: '%',
      trend: 0, dir: 'up' as const,
      spark: flatSpark(attendancePct), accent: 'blue',
      sub: attendanceStats
        ? `${attendanceStats.attendedDays} / ${attendanceStats.totalWorkingDays} DAYS · ${attendanceStats.month}`
        : null,
    },
  ], [leavesAvailable, pendingApprovals, attendancePct, attendanceStats]);

  // ── Workflow feed from notifications ─────────────────────────────────────
  const feed = notifications.slice(0, 5).map(n => ({
    kind:  notifKind(n.type),
    title: n.title,
    meta:  n.body,
    time:  new Date(n.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }),
    tone:  notifTone(n.type, n.isRead),
  }));

  // ── Week bar chart from attendance ────────────────────────────────────────
  const weekDays = ['M', 'T', 'W', 'T', 'F'];
  const weekBars = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    return weekDays.map((d, idx) => {
      const daysFromMon = idx; // 0=Mon
      const diff = (dow === 0 ? 6 : dow - 1) - daysFromMon;
      const date = new Date(now.getTime() - diff * 86400_000);
      const dateStr = date.toISOString().split('T')[0];
      const record = weekAttendance.find(r => r.date?.startsWith(dateStr ?? ''));
      const isToday = diff === 0;
      const isFuture = diff < 0;
      const h = Number(record?.workingHours ?? 0);
      return { d, h, today: isToday, future: isFuture };
    });
  }, [weekAttendance]);

  const avgShiftMins = weekBars.filter(b => !b.future && b.h > 0)
    .reduce((s, b, _, a) => s + (b.h * 60) / a.length, 0);
  const avgH = Math.floor(avgShiftMins / 60);
  const avgM = Math.round(avgShiftMins % 60);

  // Leaves expiring warning
  const expiringLeaves = leavesAvailable;

  return (
    <>
    <div className="space-y-8 w-full animate-fade-up">
      {/* Header row */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-display font-bold text-[11px] tracking-[0.28em] text-brutal-ink/60">— DASHBOARD / 01</div>
          <h1 className="mt-2 font-display font-bold text-[44px] leading-[1.1] tracking-tight text-brutal-ink">
            WELCOME BACK,<br />
            <span className="inline-block bg-brutal-yellow px-2 -ml-2 mt-1">
              {user?.firstName?.toUpperCase() ?? 'EMPLOYEE'}
            </span>
          </h1>
          <div className="mt-2 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60">{date}</div>
        </div>

        {/* Live clock card */}
        <div className="brutal-border bg-brutal-ink text-brutal-cream p-4 brutal-shadow">
          <div className="font-display font-bold text-[10px] tracking-[0.2em] text-brutal-cream/60">LOCAL · IST · GMT+05:30</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display font-bold text-[40px] leading-none">{time}</span>
            <span className="font-display font-bold text-[15px] text-brutal-cream/60">:{secs}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.18em]">
            <span className="w-2 h-2 bg-brutal-yellow animate-blink" />
            SYSTEMS NOMINAL
          </div>
        </div>
      </div>

      {/* Hero — Punch-in Station */}
      <section className="brutal-border brutal-shadow-lg bg-brutal-cream grid grid-cols-1 lg:grid-cols-[1.8fr_1fr]">
        <div className="p-7 lg:p-9">
          <div className="flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.22em]">
            <span className="px-2 py-1 bg-brutal-ink text-brutal-yellow">PUNCH-IN STATION</span>
            <span className="w-2 h-2 bg-brutal-blue" />
            <span className="text-brutal-ink/60">FACE RECOGNITION · LIVENESS V4</span>
          </div>

          <h2 className="mt-5 font-display font-bold text-[56px] leading-[0.9] tracking-[-0.02em] text-brutal-ink">
            READY <span className="text-brutal-blue">WHEN</span><br />
            YOU ARE<span className="text-brutal-red">.</span>
          </h2>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="font-display font-bold text-[10px] tracking-[0.16em] flex items-center gap-1.5 px-2 py-1.5 bg-[#0F8F3A] text-white brutal-border border-[#0F8F3A]">
              <span className="w-1.5 h-1.5 bg-white" /> GEOFENCE OK
            </span>
            <span className="font-display font-bold text-[10px] tracking-[0.16em] flex items-center gap-1.5 px-2 py-1.5 bg-brutal-surface brutal-border">
              <Wifi size={10} /> PRINCE CUBE
            </span>
            <span className="font-display font-bold text-[10px] tracking-[0.16em] flex items-center gap-1.5 px-2 py-1.5 bg-brutal-surface brutal-border">
              <MapPin size={10} /> GOTRI · VADODARA
            </span>
          </div>

          <div className="mt-7 flex items-end gap-4 flex-wrap">
            {me === undefined ? (
              <div className="px-6 py-4 brutal-border bg-brutal-surface font-display font-bold text-[13px] opacity-50">
                LOADING…
              </div>
            ) : !me?.faceEnrolled ? (
              <Link
                href="/attendance/biometric"
                className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2 bg-brutal-yellow text-brutal-ink border-brutal-ink"
              >
                <UserCheck size={18} /> ENROLL FACE FIRST <ArrowRight size={14} />
              </Link>
            ) : todayRecord?.punchOutTime ? (
              <div className="px-4 py-3 bg-[#0F8F3A] text-white font-display font-bold text-[11px] tracking-[0.18em] border-2 border-[#0F8F3A]">
                ✓ SHIFT COMPLETE
              </div>
            ) : todayRecord?.punchInTime ? (
              <button
                onClick={() => { setPunchManual(false); setPunchModal('out'); }}
                className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2 bg-brutal-red text-white border-brutal-red"
              >
                <Camera size={18} /> PUNCH OUT <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => { setPunchManual(false); setPunchModal('in'); }}
                className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2"
              >
                <Camera size={18} /> PUNCH IN <ArrowRight size={14} />
              </button>
            )}
            {/* Manual punch — always visible when face enrolled and shift not complete */}
            {me?.faceEnrolled && !todayRecord?.punchOutTime && (
              <button
                onClick={() => {
                  setPunchManual(true);
                  setPunchModal(todayRecord?.punchInTime ? 'out' : 'in');
                }}
                className="px-5 py-4 border-[3px] border-brutal-ink font-display font-bold text-[13px] tracking-[0.1em] flex items-center gap-2 hover:bg-brutal-surface transition-colors"
              >
                <MapPin size={16} /> MANUAL PUNCH
              </button>
            )}
            {todayRecord?.punchInTime && (
              <div className="border-l-[3px] border-brutal-ink pl-4 font-display font-bold text-[11px] tracking-[0.14em]">
                <div className="text-brutal-ink/60">PUNCHED IN</div>
                <div className="text-[18px] text-brutal-ink">
                  {new Date(todayRecord.punchInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                </div>
                {todayRecord.punchOutTime && (
                  <>
                    <div className="text-brutal-ink/60 mt-1">PUNCHED OUT</div>
                    <div className="text-[18px] text-brutal-ink">
                      {new Date(todayRecord.punchOutTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — scan glyph */}
        <div className="brutal-border-t lg:brutal-border-t-0 lg:border-l-[3px] lg:border-brutal-ink bg-brutal-blue relative overflow-hidden min-h-[280px]">
          <div className="absolute inset-0 diag opacity-10" />
          <div className="relative h-full p-6 flex flex-col justify-between text-white">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-white text-brutal-blue px-2 py-1 border-2 border-white">
                STATION 04
              </span>
              <span className="font-display font-bold text-[10px] tracking-[0.18em] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-brutal-yellow animate-blink" /> LIVE
              </span>
            </div>

            <div className="relative my-4 mx-auto w-full max-w-[180px] aspect-square bg-brutal-ink brutal-border" style={{ boxShadow: '4px 4px 0 0 #ffa23a' }}>
              <Fingerprint size={70} className="absolute inset-0 m-auto text-brutal-yellow/60" />
              {[
                'top-2 left-2 border-t-[3px] border-l-[3px]',
                'top-2 right-2 border-t-[3px] border-r-[3px]',
                'bottom-2 left-2 border-b-[3px] border-l-[3px]',
                'bottom-2 right-2 border-b-[3px] border-r-[3px]',
              ].map((pos, i) => (
                <span key={i} className={`absolute w-5 h-5 border-brutal-yellow ${pos}`} />
              ))}
              <div className="absolute inset-x-2 h-[3px] bg-brutal-yellow animate-scan" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'PRESENT', v: stats?.presentToday  != null ? String(stats.presentToday)  : '—' },
                { l: 'ABSENT',  v: stats?.absentToday   != null ? String(stats.absentToday)   : '—' },
                { l: 'MISSING', v: stats?.missingPunchOuts != null ? String(stats.missingPunchOuts) : '—' },
              ].map((s) => (
                <div key={s.l} className="border-2 border-white p-2">
                  <div className="font-display font-bold text-[9px] tracking-[0.18em] text-white/60">{s.l}</div>
                  <div className="font-display font-bold text-[13px]">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div className="font-display font-bold text-[11px] tracking-[0.22em] text-brutal-ink/60">— METRICS · CURRENT</div>
          <Link href="/reports" className="font-display font-bold text-[10px] tracking-[0.18em] underline underline-offset-4 hover:text-brutal-blue">
            VIEW ALL ↗
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {kpis.map((k) => {
            const sparkColor = k.accent === 'red' ? '#e63b2e' : k.accent === 'blue' ? '#0055ff' : '#1a1a1a';
            const headerBg   = k.accent === 'red' ? 'bg-brutal-red text-white' : k.accent === 'blue' ? 'bg-brutal-blue text-white' : 'bg-brutal-yellow text-brutal-ink';
            const isAttendance = k.unit === '%';
            return (
              <div key={k.label} className="brutal-border brutal-shadow bg-brutal-cream">
                <div className={`flex items-center justify-between px-4 py-2 brutal-border-b ${headerBg}`}>
                  <span className="font-display font-bold text-[10px] tracking-[0.2em]">{k.label}</span>
                  <span className="font-display font-bold text-[10px] tracking-[0.18em]">{k.unit}</span>
                </div>
                <div className="p-5 flex items-end justify-between">
                  <div className="flex-1">
                    <div className="font-display font-bold text-[52px] leading-[0.9] tracking-tight">
                      {k.value}{isAttendance ? '%' : ''}
                    </div>
                    {k.sub && (
                      <div className="mt-2 font-display font-bold text-[10px] tracking-[0.16em] text-brutal-ink/60">
                        {k.sub}
                      </div>
                    )}
                    {isAttendance && (
                      <div className="mt-3 h-2 border-2 border-brutal-ink bg-brutal-surface">
                        <div
                          className={`h-full ${k.value >= 90 ? 'bg-[#0F8F3A]' : k.value >= 75 ? 'bg-brutal-blue' : 'bg-brutal-red'}`}
                          style={{ width: `${k.value}%` }}
                        />
                      </div>
                    )}
                    {k.trend !== 0 && (
                      <div className={`mt-3 font-display font-bold text-[11px] tracking-[0.16em] inline-flex items-center gap-1 px-1.5 py-0.5 border-2 border-brutal-ink ${
                        k.dir === 'up' ? 'bg-[#0F8F3A] text-white' : 'bg-brutal-red text-white'
                      }`}>
                        {k.dir === 'up' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {k.dir === 'up' ? '+' : ''}{k.trend} VS PREV
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Sparkline data={k.spark.length >= 2 ? k.spark : [0, k.value]} color={sparkColor} />
                    <span className="font-display font-bold text-[9px] tracking-[0.18em] text-brutal-ink/50">LIVE</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feed + Side stack */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        {/* Workflow Feed from notifications */}
        <div className="brutal-border brutal-shadow bg-brutal-cream">
          <div className="flex items-center justify-between px-5 py-3 brutal-border-b bg-brutal-ink text-brutal-cream">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-[11px] tracking-[0.22em]">WORKFLOW FEED</span>
              <span className="font-display font-bold text-[10px] tracking-[0.18em] px-1.5 py-0.5 bg-brutal-yellow text-brutal-ink">LIVE</span>
            </div>
            <Link href="/requests" className="font-display font-bold text-[10px] tracking-[0.18em] hover:text-brutal-yellow">
              VIEW ALL →
            </Link>
          </div>
          {feed.length === 0 ? (
            <div className="px-6 py-8 text-center font-display font-bold text-[11px] tracking-[0.2em] text-brutal-ink/40">
              NO RECENT ACTIVITY
            </div>
          ) : (
            <ul>
              {feed.map((f, idx) => (
                <li key={idx} className={`flex items-stretch ${idx !== feed.length - 1 ? 'brutal-border-b' : ''}`}>
                  <div className={`w-16 shrink-0 grid place-items-center brutal-border-r font-display font-bold text-[10px] tracking-[0.16em] ${TONE_CLASS[f.tone]}`}>
                    {f.kind}
                  </div>
                  <div className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-brutal-surface transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-[13px] tracking-tight truncate">{f.title}</div>
                      <div className="font-display font-bold text-[10px] tracking-[0.14em] text-brutal-ink/60 uppercase mt-0.5">{f.meta}</div>
                    </div>
                    <div className="font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 flex-shrink-0">{f.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Side stack */}
        <div className="space-y-5">
          {/* Week bar chart */}
          <div className="brutal-border brutal-shadow bg-brutal-cream">
            <div className="px-4 py-2 brutal-border-b bg-brutal-blue text-white flex items-center justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em]">THIS WEEK · HRS</span>
              <span className="font-display font-bold text-[10px] tracking-[0.18em]">MON–FRI</span>
            </div>
            <div className="p-5">
              <div className="flex items-stretch justify-between gap-3 h-36">
                {weekBars.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="font-display font-bold text-[10px] tracking-tight">{b.future ? '—' : b.h > 0 ? b.h.toFixed(1) : '—'}</div>
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={`w-full border-[3px] border-brutal-ink ${b.today ? 'bg-brutal-yellow' : b.future || b.h === 0 ? 'diag bg-brutal-surface' : 'bg-brutal-ink'}`}
                        style={{ height: `${b.h > 0 ? (b.h / 12) * 100 : 5}%`, minHeight: '12px' }}
                      />
                    </div>
                    <div className={`font-display font-bold text-[11px] tracking-[0.18em] ${b.today ? 'underline underline-offset-2' : ''}`}>{b.d}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="border-[3px] border-brutal-ink p-2">
                  <div className="font-display font-bold text-[9px] tracking-[0.2em] text-brutal-ink/60">AVG SHIFT</div>
                  <div className="font-display font-bold text-[17px]">
                    {avgH > 0 || avgM > 0 ? `${avgH}H ${avgM}M` : '—'}
                  </div>
                </div>
                <div className="border-[3px] border-brutal-ink p-2 bg-brutal-yellow">
                  <div className="font-display font-bold text-[9px] tracking-[0.2em]">THIS WEEK</div>
                  <div className="font-display font-bold text-[17px]">
                    {hoursThisWeek > 0 ? `${Math.floor(hoursThisWeek)}H` : '—'}
                  </div>
                </div>
              </div>

              {/* Monthly attendance percentage bar */}
              {attendanceStats && (
                <div className="mt-3 border-t-[3px] border-brutal-ink pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-display font-bold text-[9px] tracking-[0.2em] text-brutal-ink/60">{attendanceStats.month}</span>
                    <span className="font-display font-bold text-[13px]">
                      {attendanceStats.attendedDays} / {attendanceStats.totalWorkingDays} DAYS
                    </span>
                  </div>
                  <div className="h-3 border-[3px] border-brutal-ink bg-brutal-surface">
                    <div
                      className={`h-full transition-all ${
                        attendanceStats.attendancePercent >= 90 ? 'bg-[#0F8F3A]'
                        : attendanceStats.attendancePercent >= 75 ? 'bg-brutal-blue'
                        : 'bg-brutal-red'
                      }`}
                      style={{ width: `${attendanceStats.attendancePercent}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between font-display font-bold text-[9px] tracking-[0.14em] text-brutal-ink/50">
                    <span>{attendanceStats.daysPresent}P · {attendanceStats.daysHalfDay}HD · {attendanceStats.daysOnLeave}L · {attendanceStats.daysAbsent}A</span>
                    <span>{attendanceStats.attendancePercent}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* My Leaves */}
          <div className="brutal-border brutal-shadow bg-brutal-cream">
            <div className="px-4 py-2 brutal-border-b bg-brutal-yellow text-brutal-ink flex items-center justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em]">MY LEAVES</span>
              <Link href="/leaves" className="font-display font-bold text-[10px] tracking-[0.18em] hover:underline flex items-center gap-1">
                VIEW ALL <ArrowRight size={10} />
              </Link>
            </div>
            {myLeaves.length === 0 ? (
              <div className="px-4 py-6 text-center font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/40">
                NO LEAVE REQUESTS
              </div>
            ) : (
              <div className="divide-y-[2px] divide-brutal-surface">
                {myLeaves.slice(0, 4).map((l) => {
                  const tone =
                    l.status === 'APPROVED' ? 'bg-[#0F8F3A] text-white' :
                    l.status === 'REJECTED' || l.status === 'CANCELLED' ? 'bg-brutal-red text-white' :
                    'bg-brutal-yellow text-brutal-ink';
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 grid place-items-center bg-brutal-ink text-brutal-yellow font-display font-bold text-[10px] flex-shrink-0">
                        {l.leaveType.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-[12px] truncate">{l.leaveType}</div>
                        <div className="font-display font-bold text-[10px] tracking-[0.1em] text-brutal-ink/60 truncate">
                          {new Date(l.fromDate).toLocaleDateString('en-GB')} → {new Date(l.toDate).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                      <span className={`font-display font-bold text-[9px] tracking-[0.12em] px-1.5 py-0.5 border-2 border-brutal-ink flex-shrink-0 ${tone}`}>
                        {l.status.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-4 py-2 brutal-border-t">
              <Link
                href="/leaves"
                className="w-full brutal-btn-primary py-2 text-[11px] flex items-center justify-center gap-2"
              >
                <Calendar size={12} /> APPLY FOR LEAVE
              </Link>
            </div>
          </div>

          {/* Org snapshot from real API */}
          <div className="brutal-border brutal-shadow bg-brutal-cream">
            <div className="px-4 py-2 brutal-border-b bg-brutal-ink text-brutal-cream">
              <span className="font-display font-bold text-[10px] tracking-[0.22em]">ORG SNAPSHOT</span>
            </div>
            <div className="divide-y-[3px] divide-brutal-ink">
              {[
                { icon: CheckCircle,   label: 'Present Today',    value: stats?.presentToday     ?? '—', accent: 'bg-[#0F8F3A] text-white' },
                { icon: AlertTriangle, label: 'Missing Punch',    value: stats?.missingPunchOuts ?? '—', accent: 'bg-brutal-red text-white'  },
                { icon: DollarSign,    label: 'Pending Expenses', value: stats?.pendingExpenses  ?? '—', accent: 'bg-brutal-yellow text-brutal-ink' },
                { icon: Calendar,      label: 'Pending Leaves',   value: stats?.pendingLeaves    ?? '—', accent: 'bg-brutal-blue text-white'  },
              ].map(({ icon: Icon, label, value, accent }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${accent}`}>
                    <Icon size={13} />
                  </div>
                  <span className="font-display font-bold text-[12px] flex-1 text-brutal-ink/70">{label}</span>
                  <span className="font-display font-bold text-[18px] text-brutal-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leave expiry alert */}
          {expiringLeaves > 0 && (
            <div className="relative brutal-border brutal-shadow bg-brutal-red text-white">
              <div className="absolute -top-2 -right-2 font-display font-bold text-[9px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink border-2 border-brutal-ink px-2 py-0.5 z-10">
                ACTION
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.2em]">
                  <Bell size={12} /> ACTION REQUIRED
                </div>
                <div className="mt-3 font-display font-bold text-[18px] leading-tight tracking-tight">
                  {expiringLeaves} LEAVE DAY{expiringLeaves !== 1 ? 'S' : ''} EXPIRE ON{' '}
                  <span className="bg-brutal-yellow text-brutal-ink px-1.5">31 MAR</span>.
                </div>
                <p className="mt-3 font-display font-bold text-[10px] tracking-[0.12em] text-white/90 uppercase">
                  Schedule a break before financial year close, or forfeit balance per policy.
                </p>
                <div className="mt-4">
                  <Link
                    href="/leaves"
                    className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 w-fit"
                  >
                    PLAN LEAVE <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance Table */}
      <div className="brutal-border brutal-shadow bg-brutal-cream">
        <div className="px-5 py-3 brutal-border-b flex items-center justify-between">
          <span className="font-display font-bold text-[13px] uppercase tracking-wide">RECENT ATTENDANCE</span>
          <Link href="/attendance" className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/60 hover:text-brutal-blue flex items-center gap-1">
            VIEW ALL <ArrowRight size={12} />
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="px-6 py-8 font-display font-bold text-sm uppercase text-brutal-ink/50 text-center">No recent records.</p>
        ) : (
          <div className="divide-y-[3px] divide-brutal-surface">
            {recentActivity.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-[13px] uppercase">{formatDate(r.date)}</p>
                  <p className="font-body text-[11px] text-brutal-ink/60 mt-0.5">
                    {r.punchInTime ?? '—'} → {r.punchOutTime ?? '—'}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-display font-bold uppercase border-2 border-brutal-ink ${
                  r.status === 'PRESENT' ? 'bg-brutal-yellow' :
                  r.status === 'ABSENT'  ? 'bg-brutal-red text-white' :
                  r.status === 'LATE'    ? 'bg-brutal-blue text-white' :
                  'bg-brutal-surface'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {punchModal && (
      <PunchModal
        punchType={punchModal}
        startManual={punchManual}
        onClose={() => { setPunchModal(null); setPunchManual(false); }}
      />
    )}
    </>
  );
}
