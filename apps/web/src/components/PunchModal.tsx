'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Camera, X, Check, AlertTriangle } from 'lucide-react';

type Phase = 'camera' | 'verifying' | 'success' | 'error' | 'no-camera';

export function PunchModal({ onClose, punchType = 'in' }: { onClose: () => void; punchType: 'in' | 'out' }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('camera');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [confidence, setConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Pre-warm face service while user positions their face
    apiClient.get('/attendance/face/health').catch(() => {});

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
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const handleVerify = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;
    setProgress(0);
    setPhase('verifying');

    // Get geolocation (fall back to 0,0 if denied or unavailable)
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
      await qc.invalidateQueries({ queryKey: ['attendance-recent'] });
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

          {/* Camera viewport */}
          <div className="mt-5 relative aspect-square brutal-border bg-brutal-ink overflow-hidden">
            <video
              ref={videoRef}
              muted
              playsInline
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
                  phase === 'success' ? 'bg-[#0F8F3A]' :
                  phase === 'error'   ? 'bg-brutal-red' :
                  'bg-brutal-red animate-blink'
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
