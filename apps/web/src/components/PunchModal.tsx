'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { X, Check, AlertTriangle, MapPin, Loader2 } from 'lucide-react';

type Phase = 'ready' | 'locating' | 'confirm' | 'submitting' | 'success' | 'error';

function useGeolocation() {
  const get = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        err => reject(new Error(err.message)),
        { timeout: 10000, enableHighAccuracy: true },
      );
    });
  return { get };
}

export function PunchModal({
  onClose,
  punchType = 'in',
}: {
  onClose: () => void;
  punchType: 'in' | 'out';
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const { get: getLocation } = useGeolocation();
  const label = punchType === 'in' ? 'PUNCH-IN' : 'PUNCH-OUT';

  const handleGetLocation = useCallback(async () => {
    setPhase('locating');
    setErrorMsg('');
    try {
      const loc = await getLocation();
      setCoords(loc);
      setPhase('confirm');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not get your location. Please enable GPS.');
      setPhase('error');
    }
  }, [getLocation]);

  const handleSubmit = useCallback(async () => {
    if (!coords) return;
    setPhase('submitting');
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      await apiClient.post(endpoint, {
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setPhase('success');
      await invalidateAttendance(qc);
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Punch failed. Please contact admin.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [coords, punchType, qc, onClose]);

  // Start locating immediately
  useEffect(() => {
    if (phase === 'ready') {
      handleGetLocation();
    }
  }, [phase, handleGetLocation]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}
    >
      <div className="relative w-full max-w-[520px] brutal-border brutal-shadow-lg animate-fade-up bg-brutal-cream">
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">
              LOCATION
            </span>
            <span className="font-display font-bold text-[11px] tracking-[0.22em]">
              CHECKPOINT · {label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center border-2 border-brutal-cream hover:bg-brutal-red transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-[26px] leading-[0.95] font-bold tracking-tight">
            {phase === 'success' && <>{label} <span className="bg-[#0F8F3A] text-white px-2">CONFIRMED</span>.</>}
            {phase === 'error' && <>PUNCH <span className="bg-brutal-red text-white px-2">FAILED</span>.</>}
            {(phase === 'ready' || phase === 'locating' || phase === 'confirm' || phase === 'submitting') && (
              <>RECORD <span className="bg-brutal-yellow px-2">PUNCH</span>.</>
            )}
          </h2>

          <div className="mt-1 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 uppercase">
            {phase === 'success' && 'Location verified. Admin notified.'}
            {phase === 'error' && errorMsg}
            {phase === 'ready' && 'GPS location will be captured for verification.'}
            {phase === 'locating' && 'Acquiring your GPS location…'}
            {phase === 'confirm' && coords && `Location acquired: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
            {phase === 'submitting' && 'Submitting punch…'}
          </div>

          <div className="mt-5 brutal-border bg-brutal-ink p-6 flex flex-col items-center justify-center min-h-[220px] gap-4">
            {phase === 'locating' && (
              <>
                <Loader2 size={40} className="text-brutal-yellow animate-spin" />
                <p className="text-brutal-cream/70 font-display font-bold text-[11px] tracking-[0.18em] text-center uppercase">
                  Acquiring GPS…
                </p>
              </>
            )}

            {(phase === 'confirm' || phase === 'submitting') && coords && (
              <>
                <div className="w-16 h-16 grid place-items-center bg-brutal-yellow brutal-border">
                  <MapPin size={28} className="text-brutal-ink" strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-brutal-cream font-display font-bold text-[12px] tracking-[0.18em] uppercase">Location Confirmed</p>
                  <p className="text-brutal-cream/60 font-mono text-[11px] mt-1">
                    {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  </p>
                </div>
                {phase === 'submitting' && (
                  <Loader2 size={24} className="text-brutal-yellow animate-spin" />
                )}
              </>
            )}

            {phase === 'error' && (
              <>
                <div className="w-16 h-16 grid place-items-center bg-brutal-cream brutal-border">
                  <AlertTriangle size={28} className="text-brutal-red" strokeWidth={2.5} />
                </div>
                <p className="text-brutal-cream font-display font-bold text-[11px] tracking-[0.18em] text-center uppercase">
                  {errorMsg}
                </p>
              </>
            )}

            {phase === 'success' && (
               <>
               <div className="w-20 h-20 grid place-items-center bg-brutal-yellow brutal-border brutal-shadow">
                 <Check size={36} className="text-brutal-ink" strokeWidth={3} />
               </div>
             </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            {phase === 'success' ? (
              <button
                onClick={onClose}
                className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 bg-brutal-blue text-white border-brutal-ink"
              >
                <Check size={15} /> DONE
              </button>
            ) : phase === 'error' ? (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button onClick={handleGetLocation} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
                  <MapPin size={15} /> RETRY LOCATION
                </button>
              </>
            ) : phase === 'confirm' ? (
              <>
                <button onClick={handleGetLocation} className="brutal-btn-secondary px-5 py-3 text-[13px]">
                  RETRY LOCATION
                </button>
                <button
                  onClick={handleSubmit}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
                >
                  <Check size={15} /> CONFIRM {label}
                </button>
              </>
            ) : phase === 'locating' || phase === 'submitting' || phase === 'ready' ? (
              <button disabled className="brutal-btn-primary px-5 py-3 text-[13px] opacity-60 flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> PLEASE WAIT…
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

async function invalidateAttendance(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['attendance-today'] }),
    qc.invalidateQueries({ queryKey: ['attendance-recent'] }),
    qc.invalidateQueries({ queryKey: ['attendance-all-year'] }),
  ]);
}
