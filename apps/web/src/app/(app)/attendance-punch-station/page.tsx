'use client';

import { useState, useEffect, useMemo } from 'react';
import { attendanceService } from '@/lib/api/attendance';
import { useAuthStore } from '@/store/auth.store';
import type { AttendanceRecord, AttendanceStatus } from '@/types';
import { isAttendanceBlockedUser } from '@/lib/attendance-access';
import { AdminAttendanceAdjustModal } from '@/components/AdminAttendanceAdjustModal';

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{time}</span>;
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: 'bg-success text-white',
  LATE: 'bg-primary text-on-primary',
  ABSENT: 'bg-error text-on-error',
  HALF_DAY: 'bg-secondary text-on-secondary',
  WFH: 'bg-[#7c3aed] text-white',
  OD: 'bg-[#0f766e] text-white',
  LEAVE: 'bg-on-surface-variant text-inverse-on-surface',
  HOLIDAY: 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
  MISSING_PUNCH_OUT: 'bg-error-container text-on-error-container border border-error/20',
};

// WFH #7c3aed (purple) + HALF_DAY #01677d (teal secondary)
const SPLIT_WFH_HALFDAY_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #7c3aed 50%, #01677d 50%)',
  color: '#fff',
  border: '1px solid transparent',
};

type CalendarLegendKey = AttendanceStatus | 'OD' | 'WEEKEND_OFF' | 'WFH_HALF_DAY';

const CALENDAR_MARK: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-success text-white border-success',
  LATE: 'bg-primary text-on-primary border-primary',
  ABSENT: 'bg-error text-on-error border-error',
  HALF_DAY: 'bg-secondary text-on-secondary border-secondary',
  WFH: 'bg-[#7c3aed] text-white border-[#7c3aed]',
  LEAVE: 'bg-on-surface-variant text-inverse-on-surface border-on-surface-variant',
  HOLIDAY: 'bg-tertiary-fixed-dim text-on-tertiary-fixed border-tertiary-fixed-dim',
  MISSING_PUNCH_OUT: 'bg-error-container/50 text-on-error-container border-error/30',
};

const WEEKEND_MARK = 'bg-surface-container-highest text-on-surface-variant border-outline-variant';
const OD_MARK = 'bg-[#0f766e] text-white border-[#0f766e]';

const CALENDAR_MARK_BY_LEGEND: Record<CalendarLegendKey, string> = {
  ...CALENDAR_MARK,
  OD: OD_MARK,
  WEEKEND_OFF: WEEKEND_MARK,
  WFH_HALF_DAY: '',
};

const CALENDAR_LEGEND: Array<{ key: CalendarLegendKey; label: string; dot: string; splitDot?: boolean }> = [
  { key: 'PRESENT', label: 'Present', dot: 'bg-success border-success' },
  { key: 'LATE', label: 'Late', dot: 'bg-primary border-primary' },
  { key: 'ABSENT', label: 'Absent', dot: 'bg-error border-error' },
  { key: 'HALF_DAY', label: 'Half day', dot: 'bg-secondary border-secondary' },
  { key: 'WFH', label: 'WFH', dot: 'bg-[#7c3aed] border-[#7c3aed]' },
  { key: 'OD', label: 'OD', dot: 'bg-[#0f766e] border-[#0f766e]' },
  { key: 'WFH_HALF_DAY', label: 'WFH Half day', dot: '', splitDot: true },
  { key: 'LEAVE', label: 'Leave', dot: 'bg-on-surface-variant border-on-surface-variant' },
  { key: 'HOLIDAY', label: 'Holiday', dot: 'bg-tertiary-fixed-dim border-tertiary-fixed-dim' },
  { key: 'WEEKEND_OFF', label: 'Weekend off', dot: 'bg-surface-container-highest border-outline-variant' },
  { key: 'MISSING_PUNCH_OUT', label: 'Missing punch', dot: 'bg-error-container border-error' },
];

function dateKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthBounds(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { from: dateKey(first), to: dateKey(last) };
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leading = first.getDay();
  const totalCells = Math.ceil((leading + last.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - leading + 1;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return {
      date,
      key: dateKey(date),
      inMonth: day >= 1 && day <= last.getDate(),
      isToday: dateKey(date) === dateKey(new Date()),
    };
  });
}

function hasSaturdayOff(user?: { firstName?: string } | null) {
  const firstName = user?.firstName?.trim().toLowerCase();
  return firstName === 'maanav' || firstName === 'dev';
}

function isWeekendOff(date: Date, saturdayOff: boolean) {
  const day = date.getDay();
  return day === 0 || (saturdayOff && day === 6);
}

function isPastDate(date: Date) {
  return dateKey(date) < dateKey(new Date());
}

function getCalendarLegendKey({
  record,
  holiday,
  date,
  inMonth,
  saturdayOff,
}: {
  record?: AttendanceRecord;
  holiday?: unknown;
  date: Date;
  inMonth: boolean;
  saturdayOff: boolean;
}): CalendarLegendKey | null {
  if (!inMonth) return null;
  if (record?.notes === 'HALF_DAY_WFH') return 'WFH_HALF_DAY';
  if (record?.notes === 'OD') return 'OD';
  if (record?.status) return record.status;
  if (holiday) return 'HOLIDAY';
  if (isWeekendOff(date, saturdayOff)) return 'WEEKEND_OFF';
  if (isPastDate(date)) return 'ABSENT';
  return null;
}

export default function AttendancePunchStationPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const attendanceBlocked = isAttendanceBlockedUser(user);

  const [today, setToday] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<AttendanceRecord[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [stats, setStats] = useState<any>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [punching, setPunching] = useState(false);
  const [odRecord, setOdRecord] = useState<any>(null);
  const [odMode, setOdMode] = useState<'in' | 'out' | null>(null);
  const [odPunchInTime, setOdPunchInTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [odPunchOutTime, setOdPunchOutTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [odReason, setOdReason] = useState('');
  const [odSubmitting, setOdSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const load = async () => {
    const isPowerUser = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    if (attendanceBlocked && !isPowerUser) {
      setLoading(false);
      return;
    }

    try {
      const { from, to } = monthBounds(calendarMonth);
      const [todayData, statsData, recordsData, calendarData, holidaysData, openOdData] = !attendanceBlocked
        ? await Promise.all([
            attendanceService.today().catch(() => null),
            attendanceService.myStats().catch(() => null),
            attendanceService.my({ limit: 14 }).catch(() => []),
            attendanceService.my({ from, to }).catch(() => []),
            attendanceService.holidays().catch(() => []),
            attendanceService.openOd().catch(() => null),
          ])
        : [null, null, [], [], [], null];

      setToday(todayData);
      setStats(statsData);
      setRecords(Array.isArray(recordsData) ? recordsData : recordsData?.data ?? []);
      setCalendarRecords(Array.isArray(calendarData) ? calendarData : calendarData?.data ?? []);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : holidaysData?.data ?? []);
      setOdRecord(openOdData);
      if (openOdData?.id) {
        setOdMode('out');
        setOdPunchOutTime(toDateTimeLocalValue(new Date()));
        setOdReason(openOdData.manualPunchReason === 'OD' ? '' : openOdData.manualPunchReason ?? '');
      }

      if (isAdmin) {
        const all = await attendanceService.all().catch(() => []);
        setAllRecords(Array.isArray(all) ? all.slice(0, 10) : all?.data?.slice(0, 10) ?? []);
      }
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [calendarMonth, attendanceBlocked]);

  const isPunchedIn = today?.punchInTime && !today?.punchOutTime;
  const isPunchedOut = today?.punchInTime && today?.punchOutTime;

  const handlePunch = async () => {
    if (attendanceBlocked) return;
    setError('');
    setSuccess('');
    setPunching(true);
    try {
      let pos: GeolocationPosition | null = null;
      try {
        pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
      } catch { /* geo optional */ }

      if (isPunchedIn) {
        await attendanceService.punchOut(pos?.coords.latitude, pos?.coords.longitude);
        setSuccess('Punched out successfully!');
      } else {
        await attendanceService.punchIn(pos?.coords.latitude, pos?.coords.longitude);
        setSuccess('Punched in successfully!');
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Punch failed. Please try again.');
    } finally {
      setPunching(false);
    }
  };

  const openOdPunchIn = () => {
    if (attendanceBlocked) return;
    setError('');
    setSuccess('');
    setOdMode('in');
    setOdPunchInTime(toDateTimeLocalValue(new Date()));
    setOdReason('');
  };

  const submitOdPunchIn = async () => {
    if (attendanceBlocked) return;
    setError('');
    setSuccess('');
    setOdSubmitting(true);
    try {
      await attendanceService.odPunchIn({
        punchInTime: new Date(odPunchInTime).toISOString(),
        reason: odReason || undefined,
      });
      setSuccess('OD punch-in time saved. Add punch-out time when duty is complete.');
      setOdMode(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save OD punch-in.');
    } finally {
      setOdSubmitting(false);
    }
  };

  const submitOdPunchOut = async () => {
    if (attendanceBlocked) return;
    setError('');
    setSuccess('');
    setOdSubmitting(true);
    try {
      await attendanceService.odPunchOut({
        punchOutTime: new Date(odPunchOutTime).toISOString(),
        reason: odReason || undefined,
      });
      setSuccess('OD punch-out time saved.');
      setOdMode(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save OD punch-out.');
    } finally {
      setOdSubmitting(false);
    }
  };

  const fmtTime = (t: string | null) => {
    if (!t) return '—';
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  };

  const fmtHrs = (h: number | null) => {
    if (h == null) return '—';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const statusLabel = (rec: any) => {
    if (rec?.notes === 'OD') return 'OD';
    if (rec?.status === 'MISSING_PUNCH_OUT') return 'Missing punch';
    return rec?.status?.replaceAll('_', ' ') ?? 'NOT MARKED';
  };

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const recordsByDate = useMemo(() => {
    return calendarRecords.reduce<Record<string, AttendanceRecord>>((acc, rec) => {
      acc[dateKey(rec.date)] = rec;
      return acc;
    }, {});
  }, [calendarRecords]);
  const holidaysByDate = useMemo(() => {
    return holidays.reduce<Record<string, any>>((acc, h) => {
      acc[dateKey(h.date)] = h;
      return acc;
    }, {});
  }, [holidays]);
  const selectedRecord = recordsByDate[selectedDate];
  const selectedHoliday = holidaysByDate[selectedDate];
  const saturdayOff = hasSaturdayOff(user);
  const selectedLegendKey = getCalendarLegendKey({
    record: selectedRecord,
    holiday: selectedHoliday,
    date: new Date(selectedDate),
    inMonth: selectedDate.startsWith(`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`),
    saturdayOff,
  });
  const monthLabel = calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const changeMonth = (delta: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const isPowerUser = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
  if (attendanceBlocked && !isPowerUser) {
    return (
      <div className="flex flex-col gap-lg">
        <div className="border-b border-outline-variant/30 pb-sm">
          <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
            <span className="material-symbols-outlined text-[18px]">block</span>
            ATTENDANCE
          </div>
          <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Attendance Disabled</h2>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Attendance Disabled</h2>
          <p className="text-on-surface-variant mt-xs">
            Attendance punching and attendance records are disabled for this account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">fingerprint</span>
          ATTENDANCE
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Punch Station</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Punch Station</h2>
            <p className="text-on-surface-variant mt-xs">
              Welcome back, <strong>{user?.firstName}</strong> ·{' '}
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
          {['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '') && (
            <button
              onClick={() => setAdminModalOpen(true)}
              className="px-4 py-2 rounded-xl text-sm border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container hover:shadow-sm transition-all flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
              Admin Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Clock + Punch */}
      {attendanceBlocked ? (
        <div className="glass-card rounded-2xl p-xl border border-outline-variant/30 flex flex-col items-center justify-center gap-sm text-center min-h-[220px]">
          <span className="material-symbols-outlined text-[40px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <h3 className="font-bold text-on-surface text-lg">Personal Attendance Disabled</h3>
          <p className="text-on-surface-variant text-sm max-w-md mt-1">
            Your personal attendance punching is disabled. However, as an administrator, you can still manage the team's records using the <strong>Admin Adjustment</strong> tool.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-lg">
          <div className="glass-card rounded-2xl p-xl border border-outline-variant/30 flex flex-col items-center justify-center gap-md text-center relative overflow-hidden min-h-[300px]">
            {odRecord?.id && (
              <div className="w-full max-w-sm rounded-2xl bg-primary/10 border border-primary/20 px-md py-sm text-left">
                <p className="text-xs font-black text-primary tracking-widest">OD PUNCH-OUT PENDING</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Add your OD punch-out time to complete the entry from {fmtTime(odRecord.punchInTime)}.
                </p>
              </div>
            )}

            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">CURRENT TIME</p>
            <div className="font-black text-5xl text-on-surface tabular-nums"><Clock /></div>
            <p className="text-body-sm text-on-surface-variant">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </p>

            {loading ? (
              <div className="w-40 h-12 rounded-full bg-surface-container-high animate-pulse" />
            ) : (
              <>
                {(success || error) && (
                  <div className={`text-sm font-semibold px-4 py-2 rounded-full ${success ? 'bg-tertiary/10 text-tertiary border border-tertiary/20' : 'bg-error/10 text-error border border-error/20'}`}>
                    {success || error}
                  </div>
                )}
                <div className="flex flex-col gap-sm w-full max-w-sm">
                  <button
                    onClick={handlePunch}
                    disabled={punching || isPunchedOut || !!odRecord}
                    className={`w-full py-4 rounded-full font-title-md text-title-md transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                      isPunchedIn
                        ? 'bg-error text-on-error hover:opacity-90 shadow-[0_0_20px_rgba(186,26,26,0.25)]'
                        : isPunchedOut
                        ? 'bg-surface-container-high text-on-surface-variant shadow-sm'
                        : 'bg-primary text-on-primary hover:opacity-90 shadow-[0_0_24px_rgba(170,48,0,0.3)]'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {punching ? 'hourglass_empty' : isPunchedIn ? 'logout' : isPunchedOut ? 'check_circle' : 'login'}
                    </span>
                    {punching ? 'Processing...' : isPunchedIn ? 'Punch Out' : isPunchedOut ? 'Punched Out' : 'Punch In'}
                  </button>
                  <button
                    type="button"
                    onClick={odRecord?.id ? () => setOdMode('out') : openOdPunchIn}
                    disabled={punching || (!odRecord?.id && (isPunchedIn || isPunchedOut))}
                    className="w-full py-3 rounded-full font-title-md text-title-md transition-all flex items-center justify-center gap-sm border border-outline-variant/50 bg-surface-container-low text-on-surface hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {odRecord?.id ? 'edit_note' : 'work_history'}
                    </span>
                    {odRecord?.id ? 'Add OD Punch Out' : 'OD'}
                  </button>
                </div>
                {stats && (
                  <div className="w-full max-w-sm space-y-md">
                    <div className="border-t border-outline-variant/20 pt-md grid grid-cols-3 gap-sm">
                      {[
                        { label: 'Present', value: stats.daysPresent ?? 0, color: 'text-tertiary' },
                        { label: 'Late', value: stats.daysLate ?? 0, color: 'text-primary' },
                        { label: 'Absent', value: stats.daysAbsent ?? 0, color: 'text-error' },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-on-surface-variant">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Removed Hours Worked / Designated Hours Stats */}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Today's status */}
          <div className="glass-card rounded-2xl p-lg border border-outline-variant/30 flex flex-col justify-between gap-md">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-md">TODAY'S STATUS</p>
              {loading ? (
                <div className="flex flex-col gap-sm">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-surface-container-high animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-sm">
                  {[
                    { label: 'Status', value: today?.status ?? 'NOT MARKED', badge: true },
                    { label: 'Punch In', value: fmtTime(today?.punchInTime ?? null) },
                    { label: 'Punch Out', value: fmtTime(today?.punchOutTime ?? null) },
                    { label: 'Hours', value: fmtHrs(today?.workingHours ?? null) },
                  ].map(item => (
                    <div key={item.label} className="bg-surface-container-low rounded-xl p-sm">
                      <p className="text-[10px] text-on-surface-variant font-label-caps tracking-widest">{item.label}</p>
                      {item.badge && today?.status ? (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${today.notes === 'OD' ? STATUS_COLOR.OD : STATUS_COLOR[today.status] ?? 'bg-surface-container-high text-on-surface'}`}>
                          {statusLabel(today)}
                        </span>
                      ) : (
                        <p className="font-bold text-on-surface mt-0.5">{item.value as string}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant/20 pt-md space-y-2 text-xs font-semibold text-on-surface-variant">
              <div className="flex justify-between">
                <span className="flex items-center gap-xs"><span className="material-symbols-outlined text-[16px] text-primary">location_on</span>GPS Status</span>
                <span className="text-on-surface font-mono">17.3850 N, 78.4867 E [SECURE]</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-xs"><span className="material-symbols-outlined text-[16px] text-primary">wifi</span>Network SSID</span>
                <span className="text-on-surface font-mono">OFFICE_WIFI_5G</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {odMode && (
        <div className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl p-lg">
            <div className="flex items-start justify-between gap-md">
              <div>
                <p className="font-label-caps text-label-caps text-primary tracking-widest">
                  {odMode === 'in' ? 'OD PUNCH IN' : 'OD PUNCH OUT'}
                </p>
                <h3 className="font-title-lg text-title-lg text-on-surface mt-xs">
                  {odMode === 'in' ? 'Enter OD start time' : 'Complete OD entry'}
                </h3>
                {odMode === 'out' && odRecord?.punchInTime && (
                  <p className="text-sm text-on-surface-variant mt-xs">
                    OD started at {fmtTime(odRecord.punchInTime)}.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOdMode(null)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors"
                aria-label="Close OD form"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="mt-md space-y-sm">
              <label className="block">
                <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">
                  {odMode === 'in' ? 'Punch In Time' : 'Punch Out Time'}
                </span>
                <input
                  type="datetime-local"
                  value={odMode === 'in' ? odPunchInTime : odPunchOutTime}
                  onChange={(event) => odMode === 'in' ? setOdPunchInTime(event.target.value) : setOdPunchOutTime(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-sm py-2 text-on-surface focus:border-primary focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">OD Note</span>
                <input
                  value={odReason}
                  onChange={(event) => setOdReason(event.target.value)}
                  placeholder="Client visit, field work, travel..."
                  className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-sm py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-lg flex gap-sm justify-end">
              <button
                type="button"
                onClick={() => setOdMode(null)}
                className="px-4 py-2 rounded-full border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={odMode === 'in' ? submitOdPunchIn : submitOdPunchOut}
                disabled={odSubmitting}
                className="px-5 py-2 rounded-full bg-primary text-on-primary font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {odSubmitting ? 'Saving...' : odMode === 'in' ? 'Save OD In' : 'Save OD Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly calendar */}
      {!attendanceBlocked && (
        <div className="glass-card rounded-2xl p-lg border border-outline-variant/30">
          <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-xs">
                MONTHLY ATTENDANCE
              </p>
              <h3 className="font-title-lg text-title-lg text-on-surface">{monthLabel}</h3>
            </div>
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="w-10 h-10 rounded-full border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors"
                aria-label="Previous month"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(dateKey(now));
                }}
                className="h-10 px-4 rounded-full border border-outline-variant/40 bg-surface-container-low text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="w-10 h-10 rounded-full border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors"
                aria-label="Next month"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="mt-md grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-lg">
            <div>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map(day => {
                  const rec = recordsByDate[day.key];
                  const holiday = holidaysByDate[day.key];
                  const legendKey = getCalendarLegendKey({
                    record: rec,
                    holiday,
                    date: day.date,
                    inMonth: day.inMonth,
                    saturdayOff,
                  });
                  const isSelected = selectedDate === day.key;
                  const isSplitDay = legendKey === 'WFH_HALF_DAY';
                  const markClass = legendKey
                    ? CALENDAR_MARK_BY_LEGEND[legendKey]
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30';

                  return (
                    <button
                      type="button"
                      key={day.key}
                      onClick={() => setSelectedDate(day.key)}
                      className={[
                        'min-h-[72px] rounded-2xl border p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                        day.inMonth ? (isSplitDay ? 'text-white border-transparent' : markClass) : 'bg-transparent text-on-surface-variant/30 border-transparent',
                        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
                      ].join(' ')}
                      style={day.inMonth && isSplitDay ? SPLIT_WFH_HALFDAY_STYLE : undefined}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-sm font-black tabular-nums ${day.isToday ? 'underline decoration-2 underline-offset-4' : ''}`}>
                          {day.date.getDate()}
                        </span>
                        {rec?.isRegularized && (
                          <span className="material-symbols-outlined text-[14px]" title="Regularized">edit_calendar</span>
                        )}
                      </div>
                      {rec && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] font-black tracking-wide truncate">
                            {isSplitDay ? 'WFH · HALF DAY' : statusLabel(rec).toUpperCase()}
                          </p>
                          <p className="text-[10px] opacity-80 tabular-nums">{fmtHrs(rec.workingHours)}</p>
                        </div>
                      )}
                      {holiday && !rec && (
                        <div className="mt-2">
                          <p className="text-[10px] font-black tracking-wide truncate text-on-tertiary-fixed">{holiday.title.toUpperCase()}</p>
                          <p className="text-[9px] opacity-85 text-on-tertiary-fixed font-semibold">HOLIDAY</p>
                        </div>
                      )}
                      {legendKey === 'WEEKEND_OFF' && (
                        <div className="mt-2">
                          <p className="text-[10px] font-black tracking-wide truncate text-on-surface-variant">WEEKEND OFF</p>
                        </div>
                      )}
                      {legendKey === 'ABSENT' && !rec && (
                        <div className="mt-2">
                          <p className="text-[10px] font-black tracking-wide truncate">ABSENT</p>
                          <p className="text-[9px] opacity-85 font-semibold">NO PUNCH</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-md">
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">
                SELECTED DAY
              </p>
              <h4 className="font-bold text-on-surface">
                {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
              </h4>
              {selectedRecord ? (
                <div className="mt-md space-y-sm">
                  {selectedRecord.notes === 'HALF_DAY_WFH' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-[#7c3aed] text-white">WFH</span>
                      <span className="text-xs text-on-surface-variant font-semibold">+</span>
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-secondary text-on-secondary">HALF DAY</span>
                    </div>
                  ) : (
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${selectedRecord.notes === 'OD' ? STATUS_COLOR.OD : STATUS_COLOR[selectedRecord.status] ?? 'bg-surface-container-high text-on-surface'}`}>
                      {statusLabel(selectedRecord)}
                    </span>
                  )}
                  <div className="grid grid-cols-2 gap-sm">
                    {[
                      { label: 'Punch In', value: fmtTime(selectedRecord.punchInTime) },
                      { label: 'Punch Out', value: fmtTime(selectedRecord.punchOutTime) },
                      { label: 'Hours', value: fmtHrs(selectedRecord.workingHours) },
                      { label: 'Regularized', value: selectedRecord.isRegularized ? 'Yes' : 'No' },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl bg-background/70 p-sm">
                        <p className="text-[10px] text-on-surface-variant font-label-caps tracking-widest">{item.label}</p>
                        <p className="font-semibold text-on-surface text-sm mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedLegendKey === 'HOLIDAY' ? (
                <div className="mt-md space-y-sm">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-tertiary-fixed-dim text-on-tertiary-fixed border border-tertiary-fixed-dim">
                    HOLIDAY
                  </span>
                  <h5 className="font-bold text-on-surface text-sm mt-xs">{selectedHoliday?.title}</h5>
                  <p className="text-sm text-on-surface-variant">
                    This day is marked as an official company holiday.
                  </p>
                </div>
              ) : selectedLegendKey === 'WEEKEND_OFF' ? (
                <div className="mt-md space-y-sm">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                    WEEKEND OFF
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    This day is configured as a weekly off for {saturdayOff ? 'this employee' : 'employees on the standard schedule'}.
                  </p>
                </div>
              ) : selectedLegendKey === 'ABSENT' ? (
                <div className="mt-md space-y-sm">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-error text-on-error">
                    ABSENT
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    No punch-in or punch-out was recorded for this working day.
                  </p>
                </div>
              ) : (
                <p className="mt-md text-sm text-on-surface-variant">
                  No attendance marking found for this date.
                </p>
              )}

              <div className="mt-lg border-t border-outline-variant/30 pt-md">
                <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">LEGEND</p>
                <div className="grid grid-cols-1 gap-3">
                  {CALENDAR_LEGEND.map(item => (
                    <div key={item.key} className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant">
                      {item.splitDot ? (
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7c3aed 50%, #01677d 50%)' }}
                        />
                      ) : (
                        <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${item.dot}`} />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Admin view: all team records */}
      {isAdmin && allRecords.length > 0 && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">TEAM TODAY</p>
          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="divide-y divide-outline-variant/20">
              {allRecords.map(rec => (
                <div key={rec.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                    {rec.employee?.firstName?.[0]}{rec.employee?.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{rec.employee?.firstName} {rec.employee?.lastName}</p>
                    <p className="text-[10px] text-on-surface-variant">{rec.employee?.designation ?? rec.employee?.role}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rec.notes === 'OD' ? STATUS_COLOR.OD : STATUS_COLOR[rec.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                    {statusLabel(rec)}
                  </span>
                  <p className="text-body-sm text-on-surface-variant hidden md:block">{fmtTime(rec.punchInTime)} → {fmtTime(rec.punchOutTime)}</p>
                  <p className="font-semibold text-on-surface text-sm hidden md:block">{fmtHrs(rec.workingHours)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adminModalOpen && (
        <AdminAttendanceAdjustModal
          onClose={() => setAdminModalOpen(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
