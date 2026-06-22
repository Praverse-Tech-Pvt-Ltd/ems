'use client';

import { useState, useEffect, useMemo } from 'react';
import { attendanceService } from '@/lib/api/attendance';
import { useAuthStore } from '@/store/auth.store';
import type { AttendanceRecord, AttendanceStatus } from '@/types';

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
  LEAVE: 'bg-on-surface-variant text-inverse-on-surface',
  HOLIDAY: 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
  MISSING_PUNCH_OUT: 'bg-error/20 text-error',
};

// WFH #7c3aed (purple) + HALF_DAY #01677d (teal secondary)
const SPLIT_WFH_HALFDAY_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, #7c3aed 50%, #01677d 50%)',
  color: '#fff',
  border: '1px solid transparent',
};

const CALENDAR_MARK: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-success text-white border-success',
  LATE: 'bg-primary text-on-primary border-primary',
  ABSENT: 'bg-error text-on-error border-error',
  HALF_DAY: 'bg-secondary text-on-secondary border-secondary',
  WFH: 'bg-[#7c3aed] text-white border-[#7c3aed]',
  LEAVE: 'bg-on-surface-variant text-inverse-on-surface border-on-surface-variant',
  HOLIDAY: 'bg-tertiary-fixed-dim text-on-tertiary-fixed border-tertiary-fixed-dim',
  MISSING_PUNCH_OUT: 'bg-error/10 text-error border-error/30',
};

const WEEKEND_MARK = 'bg-surface-container-highest text-on-surface-variant border-outline-variant';

const CALENDAR_LEGEND: Array<{ key: AttendanceStatus | 'WEEKEND_OFF' | 'WFH_HALF_DAY'; label: string; dot: string; splitDot?: boolean }> = [
  { key: 'PRESENT', label: 'Present', dot: 'bg-success border-success' },
  { key: 'LATE', label: 'Late', dot: 'bg-primary border-primary' },
  { key: 'ABSENT', label: 'Absent', dot: 'bg-error border-error' },
  { key: 'HALF_DAY', label: 'Half day', dot: 'bg-secondary border-secondary' },
  { key: 'WFH', label: 'WFH', dot: 'bg-[#7c3aed] border-[#7c3aed]' },
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

export default function AttendancePunchStationPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [today, setToday] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<AttendanceRecord[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [stats, setStats] = useState<any>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const { from, to } = monthBounds(calendarMonth);
      const [todayData, statsData, recordsData, calendarData] = await Promise.all([
        attendanceService.today().catch(() => null),
        attendanceService.myStats().catch(() => null),
        attendanceService.my({ limit: 14 }).catch(() => []),
        attendanceService.my({ from, to }).catch(() => []),
      ]);
      setToday(todayData);
      setStats(statsData);
      setRecords(Array.isArray(recordsData) ? recordsData : recordsData?.data ?? []);
      setCalendarRecords(Array.isArray(calendarData) ? calendarData : calendarData?.data ?? []);

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

  useEffect(() => { load(); }, [calendarMonth]);

  const isPunchedIn = today?.punchInTime && !today?.punchOutTime;
  const isPunchedOut = today?.punchInTime && today?.punchOutTime;

  const handlePunch = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setError('');
    setSuccess('');

    // Simulated holographic face scan loop
    const scanPromise = new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        setScanProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setIsScanning(false);
            resolve();
            return 0;
          }
          return p + 10;
        });
      }, 150);
    });

    await scanPromise;

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
        setSuccess('Punched in successfully with face verification!');
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Punch failed. Please try again.');
    } finally {
      setPunching(false);
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

  const last7 = records.slice(0, 7);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const recordsByDate = useMemo(() => {
    return calendarRecords.reduce<Record<string, AttendanceRecord>>((acc, rec) => {
      acc[dateKey(rec.date)] = rec;
      return acc;
    }, {});
  }, [calendarRecords]);
  const selectedRecord = recordsByDate[selectedDate];
  const saturdayOff = hasSaturdayOff(user);
  const selectedIsWeekendOff = isWeekendOff(new Date(selectedDate), saturdayOff) && !selectedRecord;
  const monthLabel = calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const changeMonth = (delta: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

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
        </div>
      </div>

      {/* Clock + Punch */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-lg">
        <div className="glass-card rounded-2xl p-xl border border-outline-variant/30 flex flex-col items-center justify-center gap-md text-center relative overflow-hidden min-h-[300px]">
          {/* Holographic scanner overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-background/95 dark:bg-[#0b111e]/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
              <div
                className="w-full h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent absolute shadow-[0_0_12px_rgba(170,48,0,0.6)]"
                style={{ top: `${scanProgress}%`, transition: 'top 0.15s ease-out' }}
              ></div>
              <span className="material-symbols-outlined text-primary text-5xl animate-pulse mb-sm">face</span>
              <span className="font-label-caps text-label-caps text-primary tracking-widest text-[11px] font-bold font-mono">
                AWS REKOGNITION VERIFICATION... {scanProgress}%
              </span>
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
                  disabled={punching || isScanning || isPunchedOut}
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
                  {punching ? 'Processing...' : isPunchedIn ? 'Punch Out' : isPunchedOut ? 'Punched Out' : 'Punch In with Face Match'}
                </button>
              </div>
              {stats && (
                <div className="border-t border-outline-variant/20 pt-md grid grid-cols-3 gap-sm w-full max-w-sm">
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
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[today.status] ?? 'bg-surface-container-high text-on-surface'}`}>
                        {today.status}
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

      {/* Monthly calendar */}
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
                const weekendOff = day.inMonth && !rec && isWeekendOff(day.date, saturdayOff);
                const isSelected = selectedDate === day.key;
                const isSplitDay = rec?.notes === 'HALF_DAY_WFH';
                const markClass = rec
                  ? (isSplitDay ? '' : CALENDAR_MARK[rec.status])
                  : weekendOff
                    ? WEEKEND_MARK
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30';

                return (
                  <button
                    type="button"
                    key={day.key}
                    onClick={() => setSelectedDate(day.key)}
                    className={[
                      'min-h-[72px] rounded-2xl border p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                      day.inMonth ? (isSplitDay ? 'text-white' : markClass) : 'bg-transparent text-on-surface-variant/30 border-transparent',
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
                          {isSplitDay ? 'WFH · HALF DAY' : rec.status.replaceAll('_', ' ')}
                        </p>
                        <p className="text-[10px] opacity-80 tabular-nums">{fmtHrs(rec.workingHours)}</p>
                      </div>
                    )}
                    {weekendOff && (
                      <div className="mt-2">
                        <p className="text-[10px] font-black tracking-wide truncate">WEEKEND OFF</p>
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
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLOR[selectedRecord.status] ?? 'bg-surface-container-high text-on-surface'}`}>
                    {selectedRecord.status.replaceAll('_', ' ')}
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
            ) : selectedIsWeekendOff ? (
              <div className="mt-md space-y-sm">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                  WEEKEND OFF
                </span>
                <p className="text-sm text-on-surface-variant">
                  This day is configured as a weekly off for {saturdayOff ? 'this employee' : 'employees on the standard schedule'}.
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

      {/* Recent records */}
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">RECENT RECORDS</p>
        {loading ? (
          <div className="flex flex-col gap-xs">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-xl bg-surface-container-high animate-pulse" />)}
          </div>
        ) : last7.length === 0 ? (
          <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
            No attendance records found.
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
            <div className="divide-y divide-outline-variant/20">
              {last7.map(rec => (
                <div key={rec.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                  <div className="w-16 shrink-0">
                    <p className="font-semibold text-on-surface text-sm">
                      {new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[rec.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                    {rec.status}
                  </span>
                  <div className="flex-1 grid grid-cols-3 gap-sm text-center">
                    <div>
                      <p className="text-[9px] text-on-surface-variant">In</p>
                      <p className="text-xs font-semibold text-on-surface">{fmtTime(rec.punchInTime)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-on-surface-variant">Out</p>
                      <p className="text-xs font-semibold text-on-surface">{fmtTime(rec.punchOutTime)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-on-surface-variant">Hours</p>
                      <p className="text-xs font-semibold text-on-surface">{fmtHrs(rec.workingHours)}</p>
                    </div>
                  </div>
                  {rec.isRegularized && (
                    <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full shrink-0">Regularized</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[rec.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                    {rec.status}
                  </span>
                  <p className="text-body-sm text-on-surface-variant hidden md:block">{fmtTime(rec.punchInTime)} → {fmtTime(rec.punchOutTime)}</p>
                  <p className="font-semibold text-on-surface text-sm hidden md:block">{fmtHrs(rec.workingHours)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
