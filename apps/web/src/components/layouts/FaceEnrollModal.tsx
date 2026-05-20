'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Check, AlertTriangle, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

type Phase = 'intro' | 'camera-starting' | 'scanning' | 'processing' | 'success' | 'error';

const TOTAL_FRAMES = 5;
const SCAN_MS = 5000;

interface Props {
  onDone: () => void; // called after successful enroll
}

export function FaceEnrollModal({ onDone }: Props) {
  const qc = useQueryClient();
  const [phase, setPhase]         = useState<Phase>('intro');
  const [progress, setProgress]   = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [errorMsg, setErrorMsg]   = useState('');

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);

  // Stop camera on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width  = video.videoWidth  || 480;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  const startEnroll = useCallback(async () => {
    framesRef.current = [];
    setFrameCount(0);
    setProgress(0);
    setErrorMsg('');
    setPhase('camera-starting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setPhase('error');
      setErrorMsg('Camera access denied. Please allow camera permissions and try again.');
      return;
    }

    await new Promise(r => setTimeout(r, 800));
    setPhase('scanning');

    const start = Date.now();
    const interval = SCAN_MS / TOTAL_FRAMES;

    const progressTimer = setInterval(() => {
      setProgress(Math.min(Math.round(((Date.now() - start) / SCAN_MS) * 100), 95));
    }, 80);

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      await new Promise(r => setTimeout(r, interval));
      const frame = captureFrame();
      if (frame) {
        framesRef.current.push(frame);
        setFrameCount(framesRef.current.length);
      }
    }

    clearInterval(progressTimer);
    setProgress(100);
    streamRef.current?.getTracks().forEach(t => t.stop());

    if (framesRef.current.length === 0) {
      setPhase('error');
      setErrorMsg('No frames captured. Ensure your face is visible and the area is well-lit.');
      return;
    }

    setPhase('processing');

    try {
      await apiClient.post('/attendance/face/enroll', { frames: framesRef.current });
      await qc.invalidateQueries({ queryKey: ['me-face'] });
      setPhase('success');
      setTimeout(onDone, 1800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Enrollment failed. Please make sure the face service is running and try again.';
      setPhase('error');
      setErrorMsg(msg);
    }
  }, [captureFrame, onDone, qc]);

  const retry = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    framesRef.current = [];
    setPhase('intro');
    setProgress(0);
    setFrameCount(0);
    setErrorMsg('');
  }, []);

  const isScanning = phase === 'camera-starting' || phase === 'scanning' || phase === 'processing';

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(4px)' }}>
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-lg brutal-border brutal-shadow-lg bg-brutal-cream animate-fade-up">

        {/* Header */}
        <div className="px-5 py-3 bg-brutal-ink text-brutal-cream brutal-border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[10px] tracking-[0.2em] bg-brutal-yellow text-brutal-ink px-2 py-0.5">
              FACE ID SETUP
            </span>
            <span className="font-display font-bold text-[11px] tracking-[0.18em]">
              REQUIRED · ONE TIME
            </span>
          </div>
          <span className="font-display font-bold text-[10px] tracking-[0.14em] text-brutal-cream/50">
            {TOTAL_FRAMES} FRAMES NEEDED
          </span>
        </div>

        <div className="p-6 space-y-5">

          {/* Title */}
          <div>
            <h2 className="font-bold text-[28px] leading-[0.95] tracking-tight">
              {phase === 'success'
                ? <>FACE ID <span className="bg-[#0F8F3A] text-white px-2">READY</span>.</>
                : phase === 'error'
                ? <>SETUP <span className="bg-brutal-red text-white px-2">FAILED</span>.</>
                : <>SET UP <span className="bg-brutal-yellow px-2">YOUR FACE</span>.</>}
            </h2>
            <p className="mt-1.5 font-display font-bold text-[11px] tracking-[0.14em] text-brutal-ink/60 uppercase">
              {phase === 'intro'      && 'Face ID is required to punch in and out. This takes about 10 seconds.'}
              {phase === 'camera-starting' && 'Starting camera — please wait…'}
              {phase === 'scanning'   && `Capturing frame ${frameCount} of ${TOTAL_FRAMES} · keep still`}
              {phase === 'processing' && 'Uploading to recognition service…'}
              {phase === 'success'    && 'Enrollment complete. You can now punch in.'}
              {phase === 'error'      && errorMsg}
            </p>
          </div>

          {/* Camera viewport */}
          <div className="relative aspect-video brutal-border bg-brutal-ink overflow-hidden">
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                (phase === 'scanning' || phase === 'camera-starting') ? 'opacity-90' : 'opacity-0'
              }`}
            />

            {/* Idle / intro */}
            {phase === 'intro' && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center text-brutal-cream/40">
                  <Camera size={56} className="mx-auto mb-3" />
                  <p className="font-display font-bold text-[10px] tracking-[0.22em]">CAMERA WILL START WHEN YOU BEGIN</p>
                </div>
              </div>
            )}

            {/* Face oval guide */}
            {(phase === 'scanning' || phase === 'camera-starting') && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-48 border-[3px] border-brutal-yellow border-dashed rounded-full opacity-70" />
              </div>
            )}

            {/* Scan line */}
            {phase === 'scanning' && (
              <div
                className="absolute left-0 right-0 h-[3px] bg-brutal-yellow z-10 transition-all duration-100"
                style={{ top: `${progress}%`, boxShadow: '0 0 16px rgba(255,162,58,0.9)' }}
              />
            )}

            {/* Frame counter badge */}
            {phase === 'scanning' && (
              <div className="absolute top-3 right-3 bg-brutal-ink border-2 border-brutal-yellow px-2 py-1 font-display font-bold text-[11px] tracking-[0.16em] text-brutal-yellow z-20">
                {frameCount}/{TOTAL_FRAMES}
              </div>
            )}

            {/* Processing spinner */}
            {phase === 'processing' && (
              <div className="absolute inset-0 grid place-items-center bg-brutal-ink/80">
                <div className="text-center text-brutal-cream">
                  <div className="w-10 h-10 border-4 border-brutal-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="font-display font-bold text-[10px] tracking-[0.2em]">PROCESSING…</p>
                </div>
              </div>
            )}

            {/* Success */}
            {phase === 'success' && (
              <div className="absolute inset-0 grid place-items-center bg-[#0F8F3A]/90">
                <div className="text-center">
                  <div className="w-16 h-16 grid place-items-center bg-brutal-yellow brutal-border mx-auto mb-3">
                    <Check size={32} className="text-brutal-ink" strokeWidth={3} />
                  </div>
                  <p className="font-display font-bold text-[11px] tracking-[0.2em] text-white">ENROLLED</p>
                </div>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="absolute inset-0 grid place-items-center bg-brutal-red/80">
                <div className="text-center">
                  <AlertTriangle size={48} className="text-white mx-auto mb-2" />
                  <p className="font-display font-bold text-[10px] tracking-[0.18em] text-white">FAILED</p>
                </div>
              </div>
            )}

            {/* Corner brackets */}
            {['top-2 left-2 border-t-[3px] border-l-[3px]', 'top-2 right-2 border-t-[3px] border-r-[3px]', 'bottom-2 left-2 border-b-[3px] border-l-[3px]', 'bottom-2 right-2 border-b-[3px] border-r-[3px]'].map((p, i) => (
              <span key={i} className={`absolute w-5 h-5 border-brutal-yellow ${p}`} />
            ))}
          </div>

          {/* Progress bar */}
          {isScanning && (
            <div className="border-2 border-brutal-ink h-2.5 bg-brutal-surface">
              <div
                className="h-full bg-brutal-blue transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Steps */}
          {phase === 'intro' && (
            <ol className="space-y-2">
              {[
                'Click Begin Setup below',
                'Allow camera access when prompted',
                'Position your face inside the oval',
                `Hold still — ${TOTAL_FRAMES} frames captured automatically`,
                'Done — punch in anytime after this',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-3 font-display font-bold text-[11px] tracking-[0.1em] text-brutal-ink/80">
                  <span className="w-5 h-5 grid place-items-center bg-brutal-ink text-brutal-yellow text-[10px] shrink-0 mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          )}

          {/* Actions */}
          <div className="pt-1">
            {phase === 'intro' && (
              <button
                onClick={startEnroll}
                className="w-full bg-brutal-yellow text-brutal-ink border-4 border-brutal-ink py-4 font-display font-bold text-[18px] uppercase tracking-tight brutal-shadow hover:bg-brutal-ink hover:text-brutal-yellow transition-colors flex items-center justify-center gap-3"
              >
                <Camera size={22} /> Begin Setup
              </button>
            )}
            {isScanning && (
              <button disabled className="w-full bg-brutal-surface border-4 border-brutal-ink py-4 font-display font-bold text-[18px] uppercase tracking-tight opacity-50 flex items-center justify-center gap-3">
                {phase === 'camera-starting' ? 'Starting Camera…' :
                 phase === 'scanning'        ? `Scanning · ${frameCount}/${TOTAL_FRAMES}` :
                 'Processing…'}
              </button>
            )}
            {phase === 'error' && (
              <button
                onClick={retry}
                className="w-full brutal-btn-secondary py-4 font-display font-bold text-[15px] uppercase tracking-tight flex items-center justify-center gap-3"
              >
                <X size={18} /> Try Again
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
