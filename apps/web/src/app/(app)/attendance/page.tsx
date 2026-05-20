'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AttendanceRecord } from '@/types';
import {
  Camera, MapPin, Wifi, ArrowRight, X, Check, AlertTriangle, UserCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

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
type Phase = 'camera' | 'verifying' | 'success' | 'error' | 'no-camera';

function PunchInModal({ onClose, punchType = 'in' }: { onClose: () => void; punchType?: PunchType }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('camera');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [confidence, setConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    apiClient.get('/attendance/face/health').catch(() => {});
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => { if (active) setPhase('no-camera'); });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const handleVerify = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;
    setProgress(0);
    setPhase('verifying');
    const coords = await new Promise<{ latitude: number; longitude: number }>(resolve => {
      if (!navigator.geolocation) return resolve({ latitude: 0, longitude: 0 });
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve({ latitude: 0, longitude: 0 }),
        { timeout: 5000 },
      );
    });
    const ticker = setInterval(() => setProgress(p => Math.min(p + 4, 90)), 80);
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      const res = await apiClient.post(endpoint, {
        faceImageBase64: frame,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      clearInterval(ticker);
      setProgress(100);
      setConfidence(Math.round((res.data?.frConfidence ?? 0.99) * 100));
      setPhase('success');
      await qc.invalidateQueries({ queryKey: ['attendance-today'] });
      await qc.invalidateQueries({ queryKey: ['attendance-all-year'] });
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      clearInterval(ticker);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Verification failed. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [captureFrame, punchType, qc, onClose]);

  const label = punchType === 'in' ? 'PUNCH-IN' : 'PUNCH-OUT';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}>
      <div className="relative w-full max-w-[520px] brutal-border brutal-shadow-lg animate-fade-up bg-brutal-cream">
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">FACE ID</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">CHECKPOINT · {label}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>
        <div className="p-5">
          <h2 className="text-[26px] leading-[0.95] font-bold tracking-tight">
            {phase === 'success'   && <>{label} <span className="bg-[#0F8F3A] text-white px-2">CONFIRMED</span>.</>}
            {phase === 'error'     && <>VERIFICATION <span className="bg-brutal-red text-white px-2">FAILED</span>.</>}
            {phase === 'no-camera' && <>CAMERA <span className="bg-brutal-red text-white px-2">UNAVAILABLE</span>.</>}
            {(phase === 'camera' || phase === 'verifying') && <>VERIFY <span className="bg-brutal-yellow px-2">IT&apos;S YOU</span>.</>}
          </h2>
          <div className="mt-1 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 uppercase">
            {phase === 'camera'    && 'Position your face in the frame, then click verify.'}
            {phase === 'verifying' && `Matching against secure template · ${progress}%`}
            {phase === 'success'   && `Welcome. Confidence ${confidence}%. Have a good shift.`}
            {phase === 'error'     && errorMsg}
            {phase === 'no-camera' && 'Camera permission denied or no camera found.'}
          </div>
          <div className="mt-5 relative aspect-square brutal-border bg-brutal-ink overflow-hidden">
            <video ref={videoRef} muted playsInline
              className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${phase === 'success' || phase === 'error' ? 'opacity-30' : 'opacity-100'}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            {phase === 'no-camera' && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center text-brutal-cream/60">
                  <Camera size={48} className="mx-auto mb-2" />
                  <p className="font-display font-bold text-[11px] tracking-[0.16em]">NO CAMERA ACCESS</p>
                </div>
              </div>
            )}
            {(phase === 'camera' || phase === 'verifying') && (
              <div className="absolute inset-5 border-2 border-brutal-yellow pointer-events-none">
                {['top-[-2px] left-[-2px] border-t-[3px] border-l-[3px]','top-[-2px] right-[-2px] border-t-[3px] border-r-[3px]','bottom-[-2px] left-[-2px] border-b-[3px] border-l-[3px]','bottom-[-2px] right-[-2px] border-b-[3px] border-r-[3px]'].map((p,i) => (
                  <span key={i} className={`absolute w-6 h-6 border-brutal-yellow ${p}`} />
                ))}
              </div>
            )}
            {phase === 'verifying' && (
              <div className="absolute inset-x-5 top-5 bottom-5 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-[3px] bg-brutal-yellow animate-scan" />
              </div>
            )}
            {phase !== 'no-camera' && (
              <div className="absolute top-3 left-3 font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-cream/95 text-brutal-ink px-2 py-1 border-2 border-brutal-cream">
                <span className={`inline-block w-2 h-2 mr-1.5 align-middle ${
                  phase === 'success' ? 'bg-[#0F8F3A]' : phase === 'error' ? 'bg-brutal-red' : 'bg-brutal-red animate-blink'
                }`} />
                {phase === 'camera' ? 'LIVE' : phase === 'verifying' ? 'MATCHING' : phase === 'success' ? `MATCH ${confidence}%` : 'FAILED'}
              </div>
            )}
            {phase === 'success' && (
              <div className="absolute inset-0 grid place-items-center bg-[#0F8F3A]/80 pointer-events-none">
                <div className="w-20 h-20 grid place-items-center bg-brutal-yellow brutal-border brutal-shadow">
                  <Check size={36} className="text-brutal-ink" strokeWidth={3} />
                </div>
              </div>
            )}
            {phase === 'error' && (
              <div className="absolute inset-0 grid place-items-center bg-brutal-red/80 pointer-events-none">
                <div className="w-20 h-20 grid place-items-center bg-brutal-cream brutal-border brutal-shadow">
                  <AlertTriangle size={36} className="text-brutal-red" strokeWidth={3} />
                </div>
              </div>
            )}
          </div>
          {phase === 'verifying' && (
            <div className="mt-4 border-2 border-brutal-ink h-3">
              <div className="h-full bg-brutal-blue transition-all duration-75" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="mt-6 flex items-center justify-end gap-3">
            {phase === 'success' ? (
              <button onClick={onClose} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 bg-brutal-blue text-white border-brutal-ink">
                <Check size={15} /> DONE
              </button>
            ) : phase === 'error' ? (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button onClick={() => setPhase('camera')} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
                  <Camera size={15} /> TRY AGAIN
                </button>
              </>
            ) : phase === 'no-camera' ? (
              <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CLOSE</button>
            ) : (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button onClick={handleVerify} disabled={phase === 'verifying'}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 disabled:opacity-60">
                  <Camera size={15} /> {phase === 'verifying' ? 'MATCHING…' : 'VERIFY FACE'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

type DayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'WFH' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'FUTURE' | 'NONE';

interface DayInfo {
  bg: string;
  text: string;
  label: string;
}

function getDayInfo(status: DayStatus): DayInfo {
  switch (status) {
    case 'PRESENT':  return { bg: 'bg-green-100 border-green-400',   text: 'text-green-800',   label: 'P' };
    case 'LATE':     return { bg: 'bg-orange-100 border-orange-400', text: 'text-orange-800',  label: 'L' };
    case 'HALF_DAY': return { bg: 'bg-sky-100 border-sky-400',       text: 'text-sky-800',     label: 'HD' };
    case 'ABSENT':   return { bg: 'bg-red-100 border-red-400',       text: 'text-red-800',     label: 'A' };
    case 'WFH':      return { bg: 'bg-teal-100 border-teal-400',     text: 'text-teal-800',    label: 'WFH' };
    case 'LEAVE':    return { bg: 'bg-indigo-100 border-indigo-400', text: 'text-indigo-800',  label: 'LV' };
    case 'HOLIDAY':  return { bg: 'bg-purple-100 border-purple-400', text: 'text-purple-800',  label: 'HOL' };
    case 'WEEKEND':  return { bg: 'bg-gray-100 border-gray-300',     text: 'text-gray-400',    label: '' };
    default:         return { bg: 'bg-brutal-cream border-brutal-ink/20', text: 'text-brutal-ink/30', label: '' };
  }
}

const LEGEND: { status: DayStatus; name: string }[] = [
  { status: 'PRESENT',  name: 'Present' },
  { status: 'LATE',     name: 'Late' },
  { status: 'HALF_DAY', name: 'Half Day' },
  { status: 'ABSENT',   name: 'Absent' },
  { status: 'WFH',      name: 'WFH / Remote' },
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
}: {
  year: number;
  month: number; // 0-indexed
  records: AttendanceRecord[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build lookup maps
  const recordsByDate: Record<string, AttendanceRecord> = {};
  for (const r of records) {
    const key = new Date(r.date).toISOString().split('T')[0] ?? '';
    if (key) recordsByDate[key] = r;
  }

  const holidayDates = new Set<string>(
    holidays.map(h => new Date(h.date).toISOString().split('T')[0] ?? '').filter(Boolean)
  );

  const leaveDates = new Set<string>();
  for (const l of leaves) {
    if (l.status !== 'APPROVED') continue;
    const from = new Date(l.fromDate);
    const to   = new Date(l.toDate);
    const cur  = new Date(from);
    while (cur <= to) {
      leaveDates.add(cur.toISOString().split('T')[0] ?? '');
      cur.setDate(cur.getDate() + 1);
    }
  }

  function classifyDay(date: Date): DayStatus {
    const isoKey = date.toISOString().split('T')[0] ?? '';
    const dow    = date.getDay(); // 0=Sun, 6=Sat
    if (date > today)           return 'FUTURE';
    if (holidayDates.has(isoKey)) return 'HOLIDAY';
    if (leaveDates.has(isoKey))   return 'LEAVE';
    if (dow === 0 || dow === 6)   return 'WEEKEND';
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
            const isoKey  = cell.date.toISOString().split('T')[0] ?? '';
            const rec     = recordsByDate[isoKey];
            const isToday = cell.date.getTime() === today.getTime();
            const holName = holidays.find(h => new Date(h.date).toISOString().split('T')[0] === isoKey)?.title;

            return (
              <div
                key={ci}
                className={`min-h-[64px] brutal-border-r last:border-r-0 p-1.5 relative border ${info.bg} ${
                  isToday ? 'ring-[3px] ring-brutal-ink ring-inset z-10' : ''
                }`}
              >
                <div className={`font-display font-bold text-[13px] leading-none mb-1 ${info.text} ${isToday ? 'underline underline-offset-2' : ''}`}>
                  {cell.day}
                </div>
                {info.label && (
                  <div className={`font-display font-bold text-[9px] tracking-[0.14em] ${info.text}`}>
                    {info.label}
                  </div>
                )}
                {holName && (
                  <div className="font-display font-bold text-[8px] tracking-tight text-purple-700 leading-tight mt-0.5 line-clamp-2">
                    {holName}
                  </div>
                )}
                {rec?.punchInTime && (
                  <div className={`font-display font-bold text-[8px] tracking-tight ${info.text} opacity-70 mt-0.5`}>
                    {fmtTime(rec.punchInTime)}
                    {rec.punchOutTime ? `–${fmtTime(rec.punchOutTime)}` : ''}
                  </div>
                )}
                {isToday && (
                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-brutal-ink" />
                )}
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

  const { data: me } = useQuery<{ faceEnrolled: boolean }>({
    queryKey: ['me-face'],
    queryFn: () => apiClient.get('/employees/me').then(r => r.data).catch(() => null),
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

      {/* Enrollment banner */}
      {me && !me.faceEnrolled && (
        <div className="brutal-border brutal-shadow bg-brutal-yellow flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
          <div className="flex items-center gap-3">
            <UserCheck size={20} className="text-brutal-ink shrink-0" />
            <div>
              <div className="font-display font-bold text-[12px] tracking-[0.2em]">FACE NOT ENROLLED</div>
              <div className="font-display font-bold text-[10px] tracking-[0.14em] text-brutal-ink/70 mt-0.5">
                You must enroll your face before punching in. It only takes 10 seconds.
              </div>
            </div>
          </div>
          <Link href="/attendance/biometric" className="brutal-btn-primary px-4 py-2 text-[11px] flex items-center gap-2 shrink-0">
            <Camera size={13} /> ENROLL NOW →
          </Link>
        </div>
      )}

      {/* Punch-in hero */}
      <section className="grid grid-cols-12 gap-0 brutal-border brutal-shadow-lg">
        <div className="col-span-12 lg:col-span-8 p-5 sm:p-7 lg:p-9 relative">
          <div className="flex items-center gap-2 font-display font-bold text-[10px] tracking-[0.22em]">
            <span className="px-2 py-1 bg-brutal-ink text-brutal-yellow">PUNCH-IN STATION</span>
            <span className="w-2 h-2 bg-brutal-blue" />
            <span className="text-brutal-ink/60">FACE RECOGNITION · LIVENESS V4</span>
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
            ) : !me?.faceEnrolled ? (
              <Link href="/attendance/biometric" className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2 bg-brutal-yellow text-brutal-ink border-brutal-ink">
                <UserCheck size={18} /> ENROLL FACE FIRST <ArrowRight size={16} />
              </Link>
            ) : todayRecord?.punchOutTime ? (
              <div className="px-4 py-3 bg-[#0F8F3A] text-white font-display font-bold text-[11px] tracking-[0.18em] border-2 border-[#0F8F3A]">
                ✓ SHIFT COMPLETE
              </div>
            ) : !todayRecord?.punchInTime ? (
              <button onClick={() => { setPunchType('in'); setShowModal(true); }} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2">
                <Camera size={18} /> PUNCH IN <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={() => { setPunchType('out'); setShowModal(true); }} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2 bg-brutal-red text-white border-brutal-red">
                <Camera size={18} /> PUNCH OUT <ArrowRight size={16} />
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
        </div>

        {/* Right — face scan panel */}
        <div className="col-span-12 lg:col-span-4 lg:border-l-[4px] brutal-border-t lg:border-t-0 border-brutal-ink bg-brutal-blue relative overflow-hidden">
          <div className="absolute inset-0 diag opacity-15" />
          <div className="relative h-full p-6 flex flex-col justify-between text-white min-h-[320px]">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-white text-brutal-blue px-2 py-1 border-2 border-white">FACE ID</span>
              <span className="font-display font-bold text-[10px] tracking-[0.18em] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-brutal-yellow animate-blink" /> LIVE
              </span>
            </div>
            <div className="relative my-6 mx-auto w-full max-w-[200px] aspect-square bg-brutal-ink brutal-border" style={{ boxShadow: '6px 6px 0 0 #ffa23a' }}>
              <div className="absolute inset-0 dotgrid opacity-30" />
              <Camera size={80} className="absolute inset-0 m-auto text-brutal-yellow/60" />
              {['top-2 left-2 border-t-[3px] border-l-[3px]','top-2 right-2 border-t-[3px] border-r-[3px]','bottom-2 left-2 border-b-[3px] border-l-[3px]','bottom-2 right-2 border-b-[3px] border-r-[3px]'].map((p,i) => (
                <span key={i} className={`absolute w-5 h-5 border-brutal-yellow ${p}`} />
              ))}
              <div className="absolute inset-x-2 h-[3px] bg-brutal-yellow animate-scan" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'METHOD', v: 'FACE' },{ l: 'LIVENESS', v: 'V4' },{ l: 'STATION', v: '04' }].map(s => (
                <div key={s.l} className="border-2 border-white p-2">
                  <div className="font-display font-bold text-[9px] tracking-[0.18em] text-white/70">{s.l}</div>
                  <div className="font-display font-bold text-[14px]">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        />

        {/* Legend */}
        <div className="px-5 py-4 brutal-border-t bg-brutal-surface">
          <div className="font-display font-bold text-[10px] tracking-[0.2em] text-brutal-ink/60 mb-3">LEGEND</div>
          <div className="flex flex-wrap gap-2">
            {LEGEND.map(({ status, name }) => {
              const info = getDayInfo(status);
              return (
                <div key={status} className={`flex items-center gap-1.5 px-2 py-1 border ${info.bg}`}>
                  <span className={`font-display font-bold text-[10px] tracking-[0.12em] ${info.text}`}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && <PunchInModal onClose={() => setShowModal(false)} punchType={punchType} />}
    </div>
  );
}
