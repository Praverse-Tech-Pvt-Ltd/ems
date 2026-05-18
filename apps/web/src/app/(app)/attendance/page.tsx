'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AttendanceRecord } from '@/types';
import {
  Fingerprint, MapPin, Wifi, ArrowRight, X, Check, Camera, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => { setT(new Date()); const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

type PunchType = 'in' | 'out';
type Phase = 'camera' | 'verifying' | 'success' | 'error' | 'no-camera';

function PunchInModal({ onClose, punchType = 'in' }: { onClose: () => void; punchType?: PunchType }) {
  const [phase, setPhase] = useState<Phase>('camera');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [confidence, setConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera on mount
  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
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
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const handleVerify = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;
    setProgress(0);
    setPhase('verifying');

    // Animate progress bar while waiting
    const ticker = setInterval(() => setProgress(p => Math.min(p + 4, 90)), 80);

    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      const res = await apiClient.post(endpoint, { faceImage: frame });
      clearInterval(ticker);
      setProgress(100);
      setConfidence(Math.round((res.data?.frConfidence ?? 0.99) * 100));
      setPhase('success');
    } catch (err: unknown) {
      clearInterval(ticker);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Verification failed. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [captureFrame, punchType]);

  const label = punchType === 'in' ? 'PUNCH-IN' : 'PUNCH-OUT';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}>
      <div className="relative w-full max-w-[520px] brutal-border brutal-shadow-lg animate-fade-up bg-brutal-cream">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">BIOMETRIC</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">CHECKPOINT · {label}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-[26px] leading-[0.95] font-bold tracking-tight">
            {phase === 'success' && <>{label} <span className="bg-[#0F8F3A] text-white px-2">CONFIRMED</span>.</>}
            {phase === 'error'   && <>VERIFICATION <span className="bg-brutal-red text-white px-2">FAILED</span>.</>}
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

          {/* Camera viewport */}
          <div className="mt-5 relative aspect-square brutal-border bg-brutal-ink overflow-hidden">
            {/* Live video */}
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${phase === 'success' || phase === 'error' ? 'opacity-30' : 'opacity-100'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* No-camera fallback */}
            {phase === 'no-camera' && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center text-brutal-cream/60">
                  <Camera size={48} className="mx-auto mb-2" />
                  <p className="font-display font-bold text-[11px] tracking-[0.16em]">NO CAMERA ACCESS</p>
                </div>
              </div>
            )}

            {/* Reticle overlay */}
            {(phase === 'camera' || phase === 'verifying') && (
              <div className="absolute inset-5 border-2 border-brutal-yellow pointer-events-none">
                {['top-[-2px] left-[-2px] border-t-[3px] border-l-[3px]','top-[-2px] right-[-2px] border-t-[3px] border-r-[3px]','bottom-[-2px] left-[-2px] border-b-[3px] border-l-[3px]','bottom-[-2px] right-[-2px] border-b-[3px] border-r-[3px]'].map((p,i) => (
                  <span key={i} className={`absolute w-6 h-6 border-brutal-yellow ${p}`} />
                ))}
              </div>
            )}

            {/* Scan line */}
            {phase === 'verifying' && (
              <div className="absolute inset-x-5 top-5 bottom-5 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-[3px] bg-brutal-yellow animate-scan" />
              </div>
            )}

            {/* Status badge */}
            {phase !== 'no-camera' && (
              <div className="absolute top-3 left-3 font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-cream/95 text-brutal-ink px-2 py-1 border-2 border-brutal-cream">
                <span className={`inline-block w-2 h-2 mr-1.5 align-middle ${
                  phase === 'success' ? 'bg-[#0F8F3A]' :
                  phase === 'error'   ? 'bg-brutal-red' :
                  'bg-brutal-red animate-blink'
                }`} />
                {phase === 'camera' ? 'LIVE' : phase === 'verifying' ? 'MATCHING' : phase === 'success' ? `MATCH ${confidence}%` : 'FAILED'}
              </div>
            )}

            {/* Success overlay */}
            {phase === 'success' && (
              <div className="absolute inset-0 grid place-items-center bg-[#0F8F3A]/80 pointer-events-none">
                <div className="w-20 h-20 grid place-items-center bg-brutal-yellow brutal-border brutal-shadow">
                  <Check size={36} className="text-brutal-ink" strokeWidth={3} />
                </div>
              </div>
            )}

            {/* Error overlay */}
            {phase === 'error' && (
              <div className="absolute inset-0 grid place-items-center bg-brutal-red/80 pointer-events-none">
                <div className="w-20 h-20 grid place-items-center bg-brutal-cream brutal-border brutal-shadow">
                  <AlertTriangle size={36} className="text-brutal-red" strokeWidth={3} />
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {phase === 'verifying' && (
            <div className="mt-4 border-2 border-brutal-ink h-3">
              <div className="h-full bg-brutal-blue transition-all duration-75" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Actions */}
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
                  <Fingerprint size={15} /> {phase === 'verifying' ? 'MATCHING…' : 'VERIFY BIOMETRICS'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const clock = useClock();
  const [showModal, setShowModal] = useState(false);
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');
  const date = clock ? clock.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : 'LOADING...';

  const { data: todayRecord } = useQuery<AttendanceRecord | null>({
    queryKey: ['attendance-today'],
    queryFn: () => apiClient.get('/attendance/today').then(r => r.data).catch(() => null),
  });

  const { data: recentActivity = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-recent'],
    queryFn: () => apiClient.get('/attendance?limit=10').then(r => r.data).catch(() => []),
  });

  return (
    <div className="space-y-8 max-w-[1320px] animate-fade-up">
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
              <Wifi size={11} /> NXGN-LAB-B
            </span>
            <span className="font-display font-bold text-[11px] tracking-[0.18em] flex items-center gap-2 px-2 py-1.5 bg-brutal-surface brutal-border">
              <MapPin size={11} /> TOWER B · LAB FLOOR
            </span>
          </div>
          <div className="mt-7 flex items-end gap-4 flex-wrap">
            <button onClick={() => { setPunchType('in'); setShowModal(true); }} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2">
              <Fingerprint size={18} /> PUNCH IN <ArrowRight size={16} />
            </button>
            {todayRecord?.punchInTime && !todayRecord?.punchOutTime && (
              <button onClick={() => { setPunchType('out'); setShowModal(true); }} className="brutal-btn-secondary px-6 py-4 text-[13px] flex items-center gap-2">
                <Fingerprint size={18} /> PUNCH OUT <ArrowRight size={16} />
              </button>
            )}
            {todayRecord?.punchInTime && (
              <div className="border-l-[3px] border-brutal-ink pl-4 font-display font-bold text-[11px] tracking-[0.14em]">
                <div className="text-brutal-ink/60">TODAY PUNCHED IN</div>
                <div className="text-[15px] num text-brutal-ink">{todayRecord.punchInTime}</div>
              </div>
            )}
          </div>
          <div className="mt-6 font-display font-bold text-[10px] tracking-[0.2em] text-brutal-ink/60">{date}</div>
        </div>

        <div className="col-span-12 lg:col-span-4 lg:border-l-[4px] brutal-border-t lg:border-t-0 border-brutal-ink bg-brutal-blue relative overflow-hidden">
          <div className="absolute inset-0 diag opacity-15" />
          <div className="relative h-full p-6 flex flex-col justify-between text-white min-h-[320px]">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-[10px] tracking-[0.22em] bg-white text-brutal-blue px-2 py-1 border-2 border-white">STATION 04</span>
              <span className="font-display font-bold text-[10px] tracking-[0.18em] flex items-center gap-1.5">
                <span className="w-2 h-2 bg-brutal-yellow animate-blink" /> LIVE
              </span>
            </div>
            <div className="relative my-6 mx-auto w-full max-w-[200px] aspect-square bg-brutal-ink brutal-border" style={{ boxShadow: '6px 6px 0 0 #ffa23a' }}>
              <div className="absolute inset-0 dotgrid opacity-30" />
              <Fingerprint size={80} className="absolute inset-0 m-auto text-brutal-yellow/60" />
              {['top-2 left-2 border-t-[3px] border-l-[3px]','top-2 right-2 border-t-[3px] border-r-[3px]','bottom-2 left-2 border-b-[3px] border-l-[3px]','bottom-2 right-2 border-b-[3px] border-r-[3px]'].map((p,i) => (
                <span key={i} className={`absolute w-5 h-5 border-brutal-yellow ${p}`} />
              ))}
              <div className="absolute inset-x-2 h-[3px] bg-brutal-yellow animate-scan" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'FRAMES', v: '24/24' },{ l: 'CONF', v: '99.8%' },{ l: 'LATCY', v: '38MS' }].map(s => (
                <div key={s.l} className="border-2 border-white p-2">
                  <div className="font-display font-bold text-[9px] tracking-[0.18em] text-white/70">{s.l}</div>
                  <div className="font-display font-bold text-[14px]">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent attendance */}
      <div className="brutal-border brutal-shadow">
        <div className="px-5 py-3 brutal-border-b flex items-center justify-between bg-brutal-ink text-brutal-cream">
          <span className="font-display font-bold text-[11px] tracking-[0.22em]">RECENT ATTENDANCE</span>
          <Link href="/attendance/biometric" className="font-display font-bold text-[10px] tracking-[0.18em] hover:text-brutal-yellow">
            ENROLL BIOMETRICS →
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-display font-bold text-[11px] tracking-[0.22em] text-brutal-ink/50">NO RECORDS YET · PUNCH IN TO BEGIN</div>
          </div>
        ) : (
          <div className="divide-y-[3px] divide-brutal-surface">
            {recentActivity.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-brutal-surface transition-colors">
                <div>
                  <p className="font-display font-bold text-[13px] uppercase">{r.date}</p>
                  <p className="font-display font-bold text-[11px] text-brutal-ink/60 mt-0.5">
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

      {showModal && <PunchInModal onClose={() => setShowModal(false)} punchType={punchType} />}
    </div>
  );
}
