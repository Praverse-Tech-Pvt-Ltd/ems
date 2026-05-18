'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AttendanceRecord } from '@/types';
import {
  Fingerprint, MapPin, Wifi, ArrowRight, X, Check,
} from 'lucide-react';
import Link from 'next/link';

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => { setT(new Date()); const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function PunchInModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'scanning' | 'verifying' | 'success'>('scanning');
  const [blink, setBlink] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setBlink(true), 1800);
    const t2 = setTimeout(() => setBlink(false), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase === 'verifying') {
      const id = setInterval(() => setCount(c => Math.min(c + 7, 100)), 80);
      const done = setTimeout(() => setPhase('success'), 1400);
      return () => { clearInterval(id); clearTimeout(done); };
    }
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}>
      <div className="relative w-full max-w-[520px] brutal-border brutal-shadow-lg animate-fade-up bg-brutal-cream">
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">BIOMETRIC</span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">CHECKPOINT · CAM 04</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition">
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-[28px] leading-[0.95] font-bold tracking-tight">
            {phase === 'success'
              ? (<>PUNCH-IN <span className="bg-[#0F8F3A] text-white px-2">CONFIRMED</span>.</>)
              : (<>VERIFY <span className="bg-brutal-yellow px-2">IT&apos;S YOU</span>.</>)}
          </h2>
          <div className="mt-2 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 uppercase">
            {phase === 'scanning'  && 'Perform liveness check — please blink.'}
            {phase === 'verifying' && `Matching against secure template · ${count}%`}
            {phase === 'success'   && 'Welcome in. Have a good shift.'}
          </div>

          {/* Viewport */}
          <div className="mt-5 relative aspect-square brutal-border bg-brutal-ink overflow-hidden">
            <div className="absolute inset-0 dotgrid opacity-25" />
            <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full p-12 text-brutal-cream/40">
              <ellipse cx="100" cy="78" rx="38" ry="46" fill="currentColor" />
              <path d="M30 200c10-40 40-58 70-58s60 18 70 58Z" fill="currentColor" />
              <circle cx="84" cy="74" r={blink ? 0.5 : 3.5} fill="#1a1a1a" className="transition-all" />
              <circle cx="116" cy="74" r={blink ? 0.5 : 3.5} fill="#1a1a1a" className="transition-all" />
            </svg>
            {/* Reticle */}
            <div className="absolute inset-5 border-2 border-brutal-yellow">
              {['top-[-2px] left-[-2px] border-t-[3px] border-l-[3px]','top-[-2px] right-[-2px] border-t-[3px] border-r-[3px]','bottom-[-2px] left-[-2px] border-b-[3px] border-l-[3px]','bottom-[-2px] right-[-2px] border-b-[3px] border-r-[3px]'].map((p,i) => (
                <span key={i} className={`absolute w-6 h-6 border-brutal-yellow ${p}`} />
              ))}
            </div>
            {phase !== 'success' && (
              <div className="absolute inset-x-5 top-5 bottom-5 overflow-hidden">
                <div className="absolute inset-x-0 h-[3px] bg-brutal-yellow animate-scan" />
              </div>
            )}
            <div className="absolute top-3 left-3 font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-cream/95 text-brutal-ink px-2 py-1 border-2 border-brutal-cream">
              <span className={`inline-block w-2 h-2 mr-1.5 align-middle ${phase === 'success' ? 'bg-[#0F8F3A]' : 'bg-brutal-red animate-blink'}`} />
              {phase === 'success' ? 'MATCH 99.8%' : phase === 'verifying' ? 'MATCHING' : 'LIVENESS'}
            </div>
            {phase === 'success' && (
              <div className="absolute inset-0 grid place-items-center bg-[#0F8F3A]/85">
                <div className="w-20 h-20 grid place-items-center bg-brutal-yellow brutal-border brutal-shadow">
                  <Check size={36} className="text-brutal-ink" strokeWidth={3} />
                </div>
              </div>
            )}
          </div>

          {phase === 'verifying' && (
            <div className="mt-4 border-2 border-brutal-ink h-3">
              <div className="h-full bg-brutal-blue" style={{ width: `${count}%` }} />
            </div>
          )}

          {/* Checklist */}
          <ul className="mt-5 space-y-2">
            {[
              { ok: true,               label: 'FACE DETECTED · CENTRED' },
              { ok: true,               label: 'OFFICE NETWORK · GEOFENCE' },
              { ok: phase !== 'scanning',label: 'LIVENESS · BLINK DETECTED' },
              { ok: phase === 'success', label: 'TEMPLATE MATCH ≥ 99%' },
            ].map((c, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={`w-5 h-5 grid place-items-center border-[3px] border-brutal-ink ${c.ok ? 'bg-[#0F8F3A]' : 'bg-brutal-surface'}`}>
                  {c.ok && <Check size={11} className="text-white" strokeWidth={3} />}
                </span>
                <span className="font-display font-bold text-[11px] tracking-[0.16em]">{c.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-end gap-3">
            {phase !== 'success' ? (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button onClick={() => { setCount(0); setPhase('verifying'); }}
                  disabled={phase === 'verifying'}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 disabled:opacity-60">
                  <Fingerprint size={15} /> {phase === 'verifying' ? 'MATCHING…' : 'VERIFY BIOMETRICS'}
                </button>
              </>
            ) : (
              <button onClick={onClose} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 bg-brutal-blue text-white border-brutal-ink">
                <Check size={15} /> DONE
              </button>
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
            <button onClick={() => setShowModal(true)} className="brutal-btn-primary px-6 py-4 text-[13px] flex items-center gap-2">
              <Fingerprint size={18} /> INITIALIZE FACE PUNCH-IN <ArrowRight size={16} />
            </button>
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

      {showModal && <PunchInModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
