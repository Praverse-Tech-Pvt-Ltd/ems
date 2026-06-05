'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AttendanceRecord } from '@/types';
import {
  Camera, MapPin, Wifi, ArrowRight, UserCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { PunchModal } from '@/components/PunchModal';

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => { setT(new Date()); const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

/** HH:MM (24-hour) in IST */
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

type PunchType = 'in' | 'out';

// ── Calendar helpers ──────────────────────────────────────────────────────────

type DayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'WFH' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'FUTURE' | 'NONE';

interface DayInfo {
  bg: string;
  text: string;
  badge: string;       // full readable label
  badgeBg: string;     // pill background
  badgeText: string;   // pill text colour
}

function getDayInfo(status: DayStatus): DayInfo {
  switch (status) {
    case 'PRESENT':  return { bg: 'bg-green-50',   text: 'text-green-900',   badge: 'PRESENT',   badgeBg: 'bg-green-600',   badgeText: 'text-white' };
    case 'LATE':     return { bg: 'bg-orange-50',  text: 'text-orange-900',  badge: 'LATE',      badgeBg: 'bg-orange-500',  badgeText: 'text-white' };
    case 'HALF_DAY': return { bg: 'bg-sky-50',     text: 'text-sky-900',     badge: 'HALF DAY',  badgeBg: 'bg-sky-500',     badgeText: 'text-white' };
    case 'ABSENT':   return { bg: 'bg-red-50',     text: 'text-red-900',     badge: 'ABSENT',    badgeBg: 'bg-red-600',     badgeText: 'text-white' };
    case 'WFH':      return { bg: 'bg-teal-50',    text: 'text-teal-900',    badge: 'WFH',       badgeBg: 'bg-teal-600',    badgeText: 'text-white' };
    case 'LEAVE':    return { bg: 'bg-indigo-50',  text: 'text-indigo-900',  badge: 'LEAVE',     badgeBg: 'bg-indigo-600',  badgeText: 'text-white' };
    case 'HOLIDAY':  return { bg: 'bg-purple-50',  text: 'text-purple-900',  badge: 'HOLIDAY',   badgeBg: 'bg-purple-600',  badgeText: 'text-white' };
    case 'WEEKEND':  return { bg: 'bg-gray-50',    text: 'text-gray-400',    badge: 'WEEKEND',   badgeBg: 'bg-gray-300',    badgeText: 'text-gray-600' };
    case 'FUTURE':   return { bg: 'bg-brutal-cream', text: 'text-brutal-ink/20', badge: '', badgeBg: '', badgeText: '' };
    default:         return { bg: 'bg-brutal-cream', text: 'text-brutal-ink/25', badge: '', badgeBg: '', badgeText: '' };
  }
}

const LEGEND: { status: DayStatus; name: string }[] = [
  { status: 'PRESENT',  name: 'Present' },
  { status: 'LATE',     name: 'Late' },
  { status: 'HALF_DAY', name: 'Half Day' },
  { status: 'WFH',      name: 'WFH / Remote' },
  { status: 'ABSENT',   name: 'Absent' },
  { status: 'LEAVE',    name: 'On Leave' },
  { status: 'HOLIDAY',  name: 'Holiday' },
  { status: 'WEEKEND',  name: 'Weekend' },
];

const MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const DAY_HEADERS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

interface Holiday { id: string; date: string; title: string; }
interface LeaveRequest { id: string; fromDate: string; toDate: string; status: string; }

function AttendanceCalendar({
  year, month,
  records,
  holidays,
  leaves,
  settings = [],
  userEmail,
}: {
  year: number;
  month: number; // 0-indexed
  records: AttendanceRecord[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
  settings?: any[];
  userEmail?: string;
}) {
  // Helper to parse days string (e.g. "10,11", "5,16", "2,4,8,12,15-20")
  function parseDays(daysStr: string): number[] {
    const result: number[] = [];
    if (!daysStr) return result;
    const parts = daysStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr = '', endStr = ''] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            result.push(i);
          }
        }
      } else {
        const parsed = parseInt(trimmed, 10);
        if (!isNaN(parsed)) {
          result.push(parsed);
        }
      }
    }
    return result;
  }

  const monthlyKey = `client_scheduling_matrix_${year}_${month}`;
  const clientSetting = settings.find(s => s.key === monthlyKey) || settings.find(s => s.key === 'client_scheduling_matrix');
  const clientSchedules = clientSetting?.value?.cells || [];
  const mySchedules = clientSchedules.filter(
    (c: any) => c.memberEmail && userEmail && c.memberEmail.toLowerCase() === userEmail.toLowerCase()
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function fmtLocalYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Build lookup maps
  const recordsByDate: Record<string, AttendanceRecord> = {};
  for (const r of records) {
    const key = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
    if (key) recordsByDate[key] = r;
  }

  const holidayDates = new Set<string>(
    holidays.map(h => typeof h.date === 'string' ? h.date.split('T')[0] : new Date(h.date).toISOString().split('T')[0]).filter((val): val is string => !!val)
  );

  const leaveDates = new Set<string>();
  for (const l of leaves) {
    if (l.status !== 'APPROVED') continue;
    const from = new Date(l.fromDate);
    const to   = new Date(l.toDate);
    const cur  = new Date(from);
    while (cur <= to) {
      leaveDates.add(fmtLocalYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  function classifyDay(date: Date): DayStatus {
    const isoKey = fmtLocalYMD(date);
    const dow    = date.getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6)   return 'WEEKEND';
    if (date > today)           return 'FUTURE';
    if (holidayDates.has(isoKey)) return 'HOLIDAY';
    if (leaveDates.has(isoKey))   return 'LEAVE';
    const rec = recordsByDate[isoKey];
    if (!rec) return 'NONE';
    return rec.status as DayStatus;
  }

  // Build calendar cells
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d) });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 brutal-border-b">
        {DAY_HEADERS.map(d => (
          <div key={d} className={`py-2 text-center font-display font-bold text-[10px] tracking-[0.18em] brutal-border-r last:border-r-0 ${
            d === 'SUN' || d === 'SAT' ? 'text-brutal-ink/40 bg-brutal-surface' : 'text-brutal-ink/70'
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {Array.from({ length: cells.length / 7 }, (_, wk) => (
        <div key={wk} className="grid grid-cols-7 brutal-border-b last:border-b-0">
          {cells.slice(wk * 7, wk * 7 + 7).map((cell, ci) => {
            if (!cell) {
              return (
                <div key={ci} className="min-h-[64px] brutal-border-r last:border-r-0 bg-brutal-surface/30" />
              );
            }
            const status  = classifyDay(cell.date);
            const info    = getDayInfo(status);
            const isoKey  = fmtLocalYMD(cell.date);
            const rec     = recordsByDate[isoKey];
            const isToday = cell.date.getTime() === today.getTime();
            const holName = holidays.find(h => (typeof h.date === 'string' ? h.date.split('T')[0] : new Date(h.date).toISOString().split('T')[0]) === isoKey)?.title;

            // Find scheduled companies for this day
            const scheduledCompanies = mySchedules
              .filter((s: any) => parseDays(s.days).includes(cell.day))
              .map((s: any) => s.company);

            return (
              <div
                key={ci}
                className={`min-h-[84px] brutal-border-r last:border-r-0 p-1.5 relative flex flex-col gap-0.5 ${info.bg} ${
                  isToday ? 'ring-[3px] ring-brutal-ink ring-inset z-10' : ''
                }`}
              >
                {/* Day number + today dot */}
                <div className="flex items-start justify-between">
                  <span className={`font-display font-bold text-[13px] leading-none ${info.text} ${isToday ? 'underline underline-offset-2' : ''}`}>
                    {cell.day}
                  </span>
                  {isToday && <span className="w-1.5 h-1.5 bg-brutal-ink shrink-0 mt-0.5" />}
                </div>

                {/* Status badge */}
                {info.badge && (
                  <span className={`self-start font-display font-bold text-[8px] tracking-[0.12em] px-1 py-0.5 leading-none ${info.badgeBg} ${info.badgeText}`}>
                    {info.badge}
                  </span>
                )}

                {/* Holiday name */}
                {holName && (
                  <div className="font-display font-bold text-[7.5px] tracking-tight text-purple-800 leading-tight line-clamp-2">
                    {holName}
                  </div>
                )}

                {/* Punch times + Client Schedules */}
                <div className="mt-auto flex flex-col gap-1">
                  {rec?.punchInTime && (
                    <div className={`font-mono text-[7px] leading-tight ${info.text} opacity-80`}>
                      <span>▶ {fmtTime(rec.punchInTime)}</span>
                      {rec.punchOutTime
                        ? <><br /><span>■ {fmtTime(rec.punchOutTime)}</span></>
                        : <><br /><span className="opacity-50">■ —</span></>
                      }
                    </div>
                  )}

                  {scheduledCompanies.map((co: string) => (
                    <div
                      key={co}
                      className="bg-brutal-blue text-white font-display font-bold text-[7.5px] leading-[1.1] px-1 py-0.5 border border-brutal-ink truncate max-w-full"
                      title={`Audit: ${co}`}
                    >
                      🏢 {co}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const clock = useClock();
  const [showModal, setShowModal] = useState(false);
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');

  const now = new Date();
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const dateStr = clock
    ? clock.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      }).toUpperCase()
    : 'LOADING...';

  const { data: me } = useQuery<{ email: string }>({
    queryKey: ['me-profile'],
    queryFn: () => apiClient.get('/employees/me').then(r => r.data).catch(() => null),
  });

  const { data: settings = [] } = useQuery<any[]>({
    queryKey: ['corporate-settings'],
    queryFn: () => apiClient.get('/corporate/settings').then(r => r.data).catch(() => []),
    staleTime: 300_000,
  });

  const { data: todayRecord } = useQuery<AttendanceRecord | null>({
    queryKey: ['attendance-today'],
    queryFn: () => apiClient.get('/attendance/today').then(r => r.data).catch(() => null),
    refetchInterval: 30_000,
  });

  // Fetch all records from Jan 1 of current year so any calendar month has data
  const yearStart = `${now.getFullYear()}-01-01`;
  const { data: allRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-all-year', now.getFullYear()],
    queryFn: () => apiClient.get(`/attendance/my?from=${yearStart}`).then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
    staleTime: 60_000,
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: () => apiClient.get('/corporate/holidays').then(r => r.data).catch(() => []),
    staleTime: 300_000,
  });

  const { data: myLeaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['my-leaves'],
    queryFn: () => apiClient.get('/leaves/my').then(r => r.data).catch(() => []),
    staleTime: 60_000,
  });

  interface PolicyAllowance { used: number; allowed: number; remaining: number; }
  interface PolicyUsage {
    latePunchIns:   PolicyAllowance;
    earlyPunchOuts: PolicyAllowance;
    halfDays:       PolicyAllowance;
    policy: { presentCutoff: string; lateCutoff: string; earlyOutCutoff: string; regularPunchOut: string; };
  }

  const { data: policyUsage } = useQuery<PolicyUsage>({
    queryKey: ['attendance-policy-usage'],
    queryFn: () => apiClient.get('/attendance/my/policy-usage').then(r => r.data).catch(() => null),
    staleTime: 60_000,
  });

  function prevMonth() {
    setCalMonth(cm => {
      if (cm.month === 0) return { year: cm.year - 1, month: 11 };
      return { year: cm.year, month: cm.month - 1 };
    });
  }

  function nextMonth() {
    setCalMonth(cm => {
      const nextM = { year: cm.year, month: cm.month + 1 };
      if (cm.month === 11) return { year: cm.year + 1, month: 0 };
      return nextM;
    });
  }

  const isCurrentMonth = calMonth.year === now.getFullYear() && calMonth.month === now.getMonth();

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">

      {/* Punch-in hero */}
      <section className="brutal-border brutal-shadow-lg p-5 sm:p-7 lg:p-9 relative">
          <div className="flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.22em]">
            <span className="px-2 py-1 bg-brutal-ink text-brutal-yellow">PUNCH-IN STATION</span>
          </div>
          <h1 className="mt-5 text-[38px] sm:text-[52px] lg:text-[64px] leading-[0.9] font-bold tracking-[-0.03em]">
            READY <span className="text-brutal-blue">WHEN</span><br />
            YOU ARE<span className="text-brutal-red">.</span>
          </h1>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="font-display font-bold text-[11px] tracking-[0.18em] flex items-center gap-2 px-2 py-1.5 bg-[#0F8F3A] text-white border-2 border-[#0F8F3A]">
              <span className="w-2 h-2 bg-white" /> GEOFENCE OK
            </span>
            <span className="font-display font-bold text-[11px] tracking-[0.18em] flex items-center gap-2 px-2 py-1.5 bg-brutal-surface brutal-border">
              <Wifi size={11} /> PRINCE CUBE
            </span>
            <span className="font-display font-bold text-[11px] tracking-[0.18em] flex items-center gap-2 px-2 py-1.5 bg-brutal-surface brutal-border">
              <MapPin size={11} /> GOTRI · VADODARA
            </span>
          </div>
          <div className="mt-7 flex items-end gap-4 flex-wrap">
            {me === undefined ? (
              <div className="px-6 py-4 brutal-border bg-brutal-surface font-display font-bold text-[13px] tracking-wide opacity-50">LOADING…</div>
            ) : todayRecord?.punchOutTime ? (
              <div className="px-4 py-3 bg-[#0F8F3A] text-white font-display font-bold text-[11px] tracking-[0.18em] border-2 border-[#0F8F3A]">
                ✓ SHIFT COMPLETE
              </div>
            ) : !todayRecord?.punchInTime ? (
              <button onClick={() => { setPunchType('in'); setShowModal(true); }} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2">
                <MapPin size={18} /> PUNCH IN <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={() => { setPunchType('out'); setShowModal(true); }} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2 bg-brutal-red text-white border-brutal-red">
                <MapPin size={18} /> PUNCH OUT <ArrowRight size={16} />
              </button>
            )}
            {todayRecord?.punchInTime && (
              <div className="border-l-[3px] border-brutal-ink pl-4 font-display font-bold text-[11px] tracking-[0.14em]">
                <div className="text-brutal-ink/60">PUNCHED IN</div>
                <div className="text-[18px] num text-brutal-ink">{fmtTime(todayRecord.punchInTime)}</div>
                {todayRecord.punchOutTime && (
                  <>
                    <div className="text-brutal-ink/60 mt-1">PUNCHED OUT</div>
                    <div className="text-[18px] num text-brutal-ink">{fmtTime(todayRecord.punchOutTime)}</div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 font-display font-bold text-[10px] tracking-[0.2em] text-brutal-ink/60">{dateStr}</div>

      </section>

      {/* ── Monthly Policy Usage ─────────────────────────────────────────── */}
      <section className="brutal-border brutal-shadow">
        <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-brutal-cream flex items-center gap-3">
          <span className="font-display font-bold text-[11px] tracking-[0.22em]">MONTHLY POLICY USAGE</span>
          <span className="font-display font-bold text-[10px] tracking-[0.16em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">
            {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-[3px] sm:divide-y-0 sm:divide-x-[3px] divide-brutal-ink">
          {[
            {
              label:     'LATE PUNCH-INS',
              sub:       '9:45–10:00 AM WINDOW',
              used:      policyUsage?.latePunchIns.used    ?? 0,
              allowed:   policyUsage?.latePunchIns.allowed ?? 4,
              remaining: policyUsage?.latePunchIns.remaining ?? 4,
              accentFull: 'bg-brutal-red text-white',
              accentBar:  'bg-orange-400',
            },
            {
              label:     'EARLY EXITS',
              sub:       'BEFORE 5:45 PM',
              used:      policyUsage?.earlyPunchOuts.used    ?? 0,
              allowed:   policyUsage?.earlyPunchOuts.allowed ?? 4,
              remaining: policyUsage?.earlyPunchOuts.remaining ?? 4,
              accentFull: 'bg-brutal-red text-white',
              accentBar:  'bg-brutal-blue',
            },
            {
              label:     'HALF DAYS',
              sub:       '>4 CONVERTS TO LEAVE',
              used:      policyUsage?.halfDays.used    ?? 0,
              allowed:   policyUsage?.halfDays.allowed ?? 4,
              remaining: policyUsage?.halfDays.remaining ?? 4,
              accentFull: 'bg-brutal-red text-white',
              accentBar:  'bg-brutal-red',
            },
          ].map(item => {
            const pct = Math.round((item.used / item.allowed) * 100);
            const exhausted = item.remaining === 0;
            return (
              <div key={item.label} className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="font-display font-bold text-[11px] tracking-[0.2em]">{item.label}</div>
                    <div className="font-display font-bold text-[9px] tracking-[0.16em] text-brutal-ink/50 mt-0.5">{item.sub}</div>
                  </div>
                  <div className={`font-display font-bold text-[11px] tracking-[0.14em] px-2 py-1 border-2 border-brutal-ink ${
                    exhausted ? item.accentFull : 'bg-brutal-surface text-brutal-ink'
                  }`}>
                    {exhausted ? 'EXHAUSTED' : `${item.remaining} LEFT`}
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display font-bold text-[36px] leading-none">{item.used}</span>
                  <span className="font-display font-bold text-[12px] text-brutal-ink/50">/ {item.allowed}</span>
                </div>
                <div className="mt-3 h-2.5 border-2 border-brutal-ink bg-brutal-surface">
                  <div
                    className={`h-full transition-all ${exhausted ? 'bg-brutal-red' : item.accentBar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Policy rule summary */}
        <div className="px-5 py-3 brutal-border-t bg-brutal-surface flex flex-wrap gap-x-6 gap-y-1">
          {[
            { k: 'ON TIME', v: '≤ 9:45 AM → PRESENT' },
            { k: 'LATE',    v: '9:45–10:00 AM · 4×/month' },
            { k: 'HALF DAY', v: '> 10:00 AM or 4 lates used' },
            { k: 'EARLY OUT', v: '< 5:45 PM · 4×/month allowed' },
            { k: 'HALF DAY CAP', v: '4/month → 5th = LEAVE' },
          ].map(r => (
            <div key={r.k} className="flex items-center gap-1.5">
              <span className="font-display font-bold text-[9px] tracking-[0.18em] text-brutal-ink/50">{r.k}:</span>
              <span className="font-display font-bold text-[9px] tracking-[0.14em]">{r.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Attendance Calendar ──────────────────────────────────────────── */}
      <div className="brutal-border brutal-shadow">

        {/* Calendar header with month navigation */}
        <div className="px-5 py-3 brutal-border-b flex items-center justify-between bg-brutal-ink text-brutal-cream">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">ATTENDANCE CALENDAR</span>
            <span className="font-display font-bold text-[10px] tracking-[0.16em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-yellow hover:text-brutal-ink transition"
            >
              <ChevronLeft size={14} />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={() => setCalMonth({ year: now.getFullYear(), month: now.getMonth() })}
                className="px-3 h-8 font-display font-bold text-[10px] tracking-[0.16em] border-2 border-brutal-cream hover:bg-brutal-yellow hover:text-brutal-ink transition"
              >
                TODAY
              </button>
            )}
            <button
              onClick={nextMonth}
              className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-yellow hover:text-brutal-ink transition"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <AttendanceCalendar
          year={calMonth.year}
          month={calMonth.month}
          records={allRecords}
          holidays={holidays}
          leaves={myLeaves}
          settings={settings}
          userEmail={me?.email}
        />

        {/* Legend */}
        <div className="px-5 py-4 brutal-border-t bg-brutal-surface">
          <div className="font-display font-bold text-[10px] tracking-[0.2em] text-brutal-ink/60 mb-3">LEGEND</div>
          <div className="flex flex-wrap gap-2">
            {LEGEND.map(({ status, name }) => {
              const info = getDayInfo(status);
              return (
                <div key={status} className={`flex items-center gap-1.5 px-2 py-1.5 ${info.bg} border border-brutal-ink/10`}>
                  <span className={`font-display font-bold text-[8px] tracking-[0.12em] px-1 py-0.5 ${info.badgeBg} ${info.badgeText}`}>
                    {info.badge || '—'}
                  </span>
                  <span className={`font-display font-bold text-[10px] tracking-[0.1em] ${info.text}`}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <PunchModal
          punchType={punchType}
          onClose={() => { setShowModal(false); }}
        />
      )}
    </div>
  );
}
