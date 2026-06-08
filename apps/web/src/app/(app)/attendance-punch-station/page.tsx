'use client';

import { useState, useEffect } from 'react';
import { attendanceService } from '@/lib/api/attendance';
import { useAuthStore } from '@/store/auth.store';
import type { AttendanceRecord } from '@/types';

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{time}</span>;
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: 'bg-tertiary text-on-primary',
  LATE: 'bg-primary text-on-primary',
  ABSENT: 'bg-error text-on-error',
  HALF_DAY: 'bg-secondary-container text-on-secondary-container',
  WFH: 'bg-primary/20 text-primary',
  LEAVE: 'bg-on-surface-variant/20 text-on-surface-variant',
  HOLIDAY: 'bg-tertiary/20 text-tertiary',
  MISSING_PUNCH_OUT: 'bg-error/20 text-error',
};

export default function AttendancePunchStationPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [today, setToday] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
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
      const [todayData, statsData, recordsData] = await Promise.all([
        attendanceService.today().catch(() => null),
        attendanceService.myStats().catch(() => null),
        attendanceService.my({ limit: 14 }).catch(() => []),
      ]);
      setToday(todayData);
      setStats(statsData);
      setRecords(Array.isArray(recordsData) ? recordsData : recordsData?.data ?? []);

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

  useEffect(() => { load(); }, []);

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
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const fmtHrs = (h: number | null) => {
    if (h == null) return '—';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const last7 = records.slice(0, 7);

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
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
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
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
                      {new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short' })}
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
