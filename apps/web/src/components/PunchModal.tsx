'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Camera, X, Check, AlertTriangle, MapPin, Loader2 } from 'lucide-react';

type Phase =
  | 'checking'       // Checking face service health on load
  | 'camera'         // Camera live, ready to verify
  | 'verifying'      // FR request in flight
  | 'success'
  | 'error'
  | 'no-camera'
  | 'manual-ready'   // Face service down — show manual punch UI
  | 'manual-locating'// Acquiring GPS for manual punch
  | 'manual-confirm' // GPS acquired, ready to submit
  | 'manual-submitting';

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
  startManual = false,
}: {
  onClose: () => void;
  punchType: 'in' | 'out';
  startManual?: boolean;
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('checking');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoError, setGeoError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { get: getLocation } = useGeolocation();

  const label = punchType === 'in' ? 'PUNCH-IN' : 'PUNCH-OUT';

  // ── On mount: check face service health, then start camera ────────────────
  useEffect(() => {
    let active = true;

    async function init() {
      // Skip health check if user explicitly requested manual punch
      if (startManual) {
        if (active) setPhase('manual-ready');
        return;
      }

      // 1. Check face service
      let faceOnline = false;
      try {
        const { data } = await apiClient.get<{ status: string }>('/attendance/face/health');
        faceOnline = data.status === 'ok';
      } catch {
        faceOnline = false;
      }

      if (!active) return;

      if (!faceOnline) {
        setPhase('manual-ready');
        return;
      }

      // 2. Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 480, height: 480 },
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setPhase('camera');
      } catch {
        if (active) setPhase('no-camera');
      }
    }

    init();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startManual]);

  // ── Face verification path ─────────────────────────────────────────────────
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

    // GPS is required — without it the server marks the punch as WFH.
    let geoCoords: { latitude: number; longitude: number };
    try {
      geoCoords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          err => reject(new Error(err.message || 'Location access denied. Please enable GPS and try again.')),
          { timeout: 8000, enableHighAccuracy: true },
        );
      });
    } catch (gpsErr) {
      setErrorMsg((gpsErr as Error).message || 'GPS unavailable. Please enable location and try again.');
      setPhase('error');
      return;
    }

    const ticker = setInterval(() => setProgress(p => Math.min(p + 4, 90)), 80);
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      const res = await apiClient.post(endpoint, {
        faceImageBase64: frame,
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
      });
      clearInterval(ticker);
      setProgress(100);
      setConfidence(Math.round((res.data?.frConfidence ?? 0.99) * 100));
      setPhase('success');
      await invalidateAttendance(qc);
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      clearInterval(ticker);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Verification failed. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [captureFrame, punchType, qc, onClose]);

  // ── Manual punch path ──────────────────────────────────────────────────────
  const handleGetLocation = useCallback(async () => {
    setPhase('manual-locating');
    setGeoError('');
    try {
      const loc = await getLocation();
      setCoords(loc);
      setPhase('manual-confirm');
    } catch (err) {
      setGeoError((err as Error).message || 'Could not get your location. Please enable GPS.');
      setPhase('manual-ready');
    }
  }, [getLocation]);

  const handleManualSubmit = useCallback(async () => {
    if (!coords) return;
    setPhase('manual-submitting');
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      await apiClient.post(endpoint, {
        manualPunch: true,
        manualPunchReason: startManual ? 'Manual punch — user initiated' : 'Face recognition service unavailable',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setPhase('success');
      await invalidateAttendance(qc);
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Manual punch failed. Please contact admin.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [coords, punchType, qc, onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{ background: 'rgba(15,15,15,0.65)', backdropFilter: 'blur(3px)' }}
    >
      <div className="relative w-full max-w-[520px] brutal-border brutal-shadow-lg animate-fade-up bg-brutal-cream">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">
              {isManualPhase(phase) ? 'MANUAL' : 'FACE ID'}
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
          {/* Title */}
          <h2 className="text-[26px] leading-[0.95] font-bold tracking-tight">
            {phase === 'success' && (
              <>{label} <span className="bg-[#0F8F3A] text-white px-2">CONFIRMED</span>.</>
            )}
            {phase === 'error' && (
              <>VERIFICATION <span className="bg-brutal-red text-white px-2">FAILED</span>.</>
            )}
            {phase === 'no-camera' && (
              <>CAMERA <span className="bg-brutal-red text-white px-2">UNAVAILABLE</span>.</>
            )}
            {phase === 'checking' && (
              <>SYSTEM <span className="bg-brutal-yellow px-2">CHECKING</span>…</>
            )}
            {(phase === 'camera' || phase === 'verifying') && (
              <>VERIFY <span className="bg-brutal-yellow px-2">IT&apos;S YOU</span>.</>
            )}
            {(phase === 'manual-ready' || phase === 'manual-locating' || phase === 'manual-confirm' || phase === 'manual-submitting') && (
              <>MANUAL <span className="bg-brutal-yellow px-2">PUNCH</span>.</>
            )}
          </h2>

          {/* Subtitle */}
          <div className="mt-1 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-ink/60 uppercase">
            {phase === 'checking'          && 'Checking face recognition service…'}
            {phase === 'camera'            && 'Position your face in the frame, then click verify.'}
            {phase === 'verifying'         && `Matching against secure template · ${progress}%`}
            {phase === 'success'           && (isManualPhase(phase) ? 'Location verified. Admin notified.' : `Welcome. Confidence ${confidence}%. Have a good shift.`)}
            {phase === 'error'             && errorMsg}
            {phase === 'no-camera'         && 'Camera permission denied or no camera found.'}
            {phase === 'manual-ready'      && (startManual ? 'GPS location will be captured for verification. Admin will be notified.' : 'Face service unavailable. Use GPS location to punch in manually.')}
            {phase === 'manual-locating'   && 'Acquiring your GPS location…'}
            {phase === 'manual-confirm'    && coords && `Location acquired: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
            {phase === 'manual-submitting' && 'Submitting manual punch…'}
          </div>

          {geoError && (
            <div className="mt-2 text-brutal-red font-display font-bold text-[10px] tracking-[0.15em]">
              {geoError}
            </div>
          )}

          {/* ── Face camera viewport ── */}
          {!isManualPhase(phase) && phase !== 'checking' && (
            <div className="mt-5 relative aspect-square brutal-border bg-brutal-ink overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
                  phase === 'success' || phase === 'error' ? 'opacity-30' : 'opacity-100'
                }`}
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
                  {['top-[-2px] left-[-2px] border-t-[3px] border-l-[3px]','top-[-2px] right-[-2px] border-t-[3px] border-r-[3px]','bottom-[-2px] left-[-2px] border-b-[3px] border-l-[3px]','bottom-[-2px] right-[-2px] border-b-[3px] border-r-[3px]'].map((p, i) => (
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
                  <span
                    className={`inline-block w-2 h-2 mr-1.5 align-middle ${
                      phase === 'success' ? 'bg-[#0F8F3A]' :
                      phase === 'error'   ? 'bg-brutal-red' :
                      'bg-brutal-red animate-blink'
                    }`}
                  />
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
          )}

          {/* ── Manual punch viewport ── */}
          {isManualPhase(phase) && (
            <div className="mt-5 brutal-border bg-brutal-ink p-6 flex flex-col items-center justify-center min-h-[220px] gap-4">
              {phase === 'manual-ready' && (
                <>
                  <div className="w-16 h-16 grid place-items-center bg-brutal-yellow brutal-border">
                    <AlertTriangle size={28} className="text-brutal-ink" strokeWidth={2.5} />
                  </div>
                  <p className="text-brutal-cream/80 font-display font-bold text-[11px] tracking-[0.18em] text-center uppercase">
                    Face recognition is offline.<br />GPS location will be captured for verification.<br />Admin will review this punch.
                  </p>
                </>
              )}

              {phase === 'manual-locating' && (
                <>
                  <Loader2 size={40} className="text-brutal-yellow animate-spin" />
                  <p className="text-brutal-cream/70 font-display font-bold text-[11px] tracking-[0.18em] text-center uppercase">
                    Acquiring GPS…
                  </p>
                </>
              )}

              {(phase === 'manual-confirm' || phase === 'manual-submitting') && coords && (
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
                  {phase === 'manual-submitting' && (
                    <Loader2 size={24} className="text-brutal-yellow animate-spin" />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Checking spinner ── */}
          {phase === 'checking' && (
            <div className="mt-5 brutal-border bg-brutal-ink p-6 flex flex-col items-center justify-center min-h-[220px] gap-4">
              <Loader2 size={40} className="text-brutal-yellow animate-spin" />
              <p className="text-brutal-cream/70 font-display font-bold text-[11px] tracking-[0.18em] uppercase">
                Initialising…
              </p>
            </div>
          )}

          {phase === 'verifying' && (
            <div className="mt-4 border-2 border-brutal-ink h-3">
              <div className="h-full bg-brutal-blue transition-all duration-75" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* ── Action buttons ── */}
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
                <button onClick={() => setPhase('camera')} className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2">
                  <Camera size={15} /> TRY AGAIN
                </button>
              </>

            ) : phase === 'no-camera' ? (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CLOSE</button>
                <button
                  onClick={() => setPhase('manual-ready')}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
                >
                  <MapPin size={15} /> USE MANUAL PUNCH
                </button>
              </>

            ) : phase === 'manual-ready' ? (
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button
                  onClick={handleGetLocation}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
                >
                  <MapPin size={15} /> GET MY LOCATION
                </button>
              </>

            ) : phase === 'manual-confirm' ? (
              <>
                <button onClick={() => { setCoords(null); setPhase('manual-ready'); }} className="brutal-btn-secondary px-5 py-3 text-[13px]">
                  RETRY LOCATION
                </button>
                <button
                  onClick={handleManualSubmit}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2"
                >
                  <Check size={15} /> CONFIRM {label}
                </button>
              </>

            ) : phase === 'checking' || phase === 'manual-locating' || phase === 'manual-submitting' ? (
              <button disabled className="brutal-btn-primary px-5 py-3 text-[13px] opacity-60 flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> PLEASE WAIT…
              </button>

            ) : (
              /* camera phase */
              <>
                <button onClick={onClose} className="brutal-btn-secondary px-5 py-3 text-[13px]">CANCEL</button>
                <button
                  onClick={handleVerify}
                  disabled={phase === 'verifying'}
                  className="brutal-btn-primary px-5 py-3 text-[13px] flex items-center gap-2 disabled:opacity-60"
                >
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

function isManualPhase(phase: Phase): boolean {
  return phase === 'manual-ready' || phase === 'manual-locating' || phase === 'manual-confirm' || phase === 'manual-submitting';
}

async function invalidateAttendance(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['attendance-today'] }),
    qc.invalidateQueries({ queryKey: ['attendance-recent'] }),
    qc.invalidateQueries({ queryKey: ['attendance-all-year'] }),
  ]);
}
