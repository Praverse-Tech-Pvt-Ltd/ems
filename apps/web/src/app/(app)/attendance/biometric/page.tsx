'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CheckCircle, AlertCircle, ArrowLeft, Sun, Move, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type State = 'idle' | 'camera-starting' | 'scanning' | 'processing' | 'success' | 'error';

const CAPTURE_FRAMES = 5; // number of frames to capture during scan
const SCAN_DURATION_MS = 5000;

export default function BiometricPage() {
  const router = useRouter();
  const [state, setState]     = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const framesRef  = useRef<string[]>([]);

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

  const beginScan = useCallback(async () => {
    setState('camera-starting');
    framesRef.current = [];
    setFrameCount(0);
    setProgress(0);

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
      setState('error');
      setMessage('Camera access denied. Please allow camera permissions and try again.');
      return;
    }

    // Wait briefly for camera to settle
    await new Promise(r => setTimeout(r, 800));
    setState('scanning');

    const startTime = Date.now();
    const captureInterval = SCAN_DURATION_MS / CAPTURE_FRAMES;

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(Math.round((elapsed / SCAN_DURATION_MS) * 100), 95));
    }, 100);

    // Capture frames evenly across the scan window
    for (let i = 0; i < CAPTURE_FRAMES; i++) {
      await new Promise(r => setTimeout(r, captureInterval));
      const frame = captureFrame();
      if (frame) {
        framesRef.current.push(frame);
        setFrameCount(framesRef.current.length);
      }
    }

    clearInterval(progressTimer);
    setProgress(100);

    if (framesRef.current.length === 0) {
      setState('error');
      setMessage('Could not capture any frames. Ensure your face is visible and well-lit.');
      streamRef.current?.getTracks().forEach(t => t.stop());
      return;
    }

    setState('processing');
    streamRef.current?.getTracks().forEach(t => t.stop());

    try {
      await apiClient.post('/attendance/face/enroll', { frames: framesRef.current });
      setState('success');
      setMessage(`Face enrolled successfully using ${framesRef.current.length} frames. You can now punch in.`);
      setTimeout(() => router.push('/attendance'), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Enrollment failed. Please try again in better lighting.';
      setState('error');
      setMessage(msg);
    }
  }, [captureFrame, router]);

  const reset = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    framesRef.current = [];
    setState('idle');
    setMessage('');
    setProgress(0);
    setFrameCount(0);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const segments = 5;
  const filledSegments = Math.round((progress / 100) * segments);
  const isActive = state === 'scanning' || state === 'processing' || state === 'camera-starting';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-start justify-between brutal-border-b pb-6">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Face ID<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Enrollment</span>
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <div className={`w-3 h-3 border-2 border-brutal-ink ${
              state === 'success'                        ? 'bg-[#0F8F3A]' :
              state === 'error'                          ? 'bg-brutal-red' :
              isActive                                   ? 'bg-brutal-blue animate-pulse' :
              'bg-brutal-surface'
            }`} />
            <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a]">
              {state === 'idle'            && 'Ready — press Begin Scan'}
              {state === 'camera-starting' && 'Starting camera…'}
              {state === 'scanning'        && `Capturing · ${frameCount}/${CAPTURE_FRAMES} frames`}
              {state === 'processing'      && 'Uploading to recognition service…'}
              {state === 'success'         && 'Enrolled — redirecting…'}
              {state === 'error'           && 'Enrollment failed'}
            </p>
          </div>
        </div>
        <Link
          href="/attendance"
          className="brutal-border p-2 bg-brutal-cream hover:bg-brutal-ink hover:text-brutal-yellow transition-colors brutal-shadow"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Mode badge */}
      <div className="flex gap-0 brutal-border brutal-shadow w-fit">
        <div className="flex items-center gap-2 px-6 py-3 font-display font-bold text-sm uppercase tracking-wide bg-brutal-ink text-brutal-yellow">
          <Camera size={16} /> Face ID · {CAPTURE_FRAMES} Frames
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-start">
        {/* Scanner viewport */}
        <div className="relative aspect-square bg-brutal-ink border-4 border-brutal-ink brutal-shadow-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
              isActive && state !== 'processing' ? 'opacity-80 grayscale' : 'opacity-0'
            }`}
          />

          {/* Corner brackets */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
            <div key={pos} className={`absolute w-12 h-12 border-[8px] border-brutal-yellow ${
              pos === 'tl' ? 'top-4 left-4 border-r-0 border-b-0' :
              pos === 'tr' ? 'top-4 right-4 border-l-0 border-b-0' :
              pos === 'bl' ? 'bottom-4 left-4 border-r-0 border-t-0' :
                             'bottom-4 right-4 border-l-0 border-t-0'
            }`} />
          ))}

          {/* HUD */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
            <div className="bg-brutal-ink border-[3px] border-brutal-yellow px-3 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-yellow">
              {state === 'camera-starting' ? 'Starting…' :
               state === 'scanning'        ? `Scanning · ${frameCount}/${CAPTURE_FRAMES}` :
               state === 'processing'      ? 'Processing…' : 'Standby'}
            </div>
            {state === 'scanning' && (
              <div className="bg-brutal-ink border-[3px] border-brutal-blue px-3 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-blue">
                {progress}%
              </div>
            )}
          </div>

          {/* Face guide oval */}
          {(state === 'scanning' || state === 'camera-starting') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-64 border-[3px] border-brutal-yellow border-dashed rounded-full opacity-60" />
            </div>
          )}

          {/* Scan line */}
          {state === 'scanning' && (
            <div
              className="absolute left-0 right-0 h-[3px] bg-brutal-yellow z-20 transition-all duration-150"
              style={{ top: `${progress}%`, boxShadow: '0 0 20px rgba(255,162,58,0.8)' }}
            />
          )}

          {/* Idle placeholder */}
          {state === 'idle' && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center text-brutal-cream/40">
                <Camera size={64} className="mx-auto mb-3" />
                <p className="font-display font-bold text-[11px] tracking-[0.2em]">PRESS BEGIN SCAN</p>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {state === 'success' && (
            <div className="absolute inset-0 bg-[#0F8F3A]/90 flex flex-col items-center justify-center z-30">
              <CheckCircle size={72} className="text-brutal-yellow mb-4" />
              <p className="font-display font-bold text-xl uppercase tracking-tight text-white">Enrolled!</p>
            </div>
          )}

          {state === 'error' && (
            <div className="absolute inset-0 bg-brutal-red/90 flex flex-col items-center justify-center z-30">
              <AlertCircle size={72} className="text-white mb-4" />
              <p className="font-display font-bold text-xl uppercase tracking-tight text-white">Failed</p>
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-brutal-ink border-[3px] border-brutal-blue px-4 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-blue z-10">
            SEQ: ENROLL_ALPHA
          </div>
        </div>

        {/* Side controls */}
        <div className="flex flex-col gap-6 w-full md:w-72">
          {/* Telemetry */}
          <div className="bg-brutal-white brutal-border brutal-shadow p-5">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-2 mb-4 flex items-center justify-between">
              Capture Status <Sun size={16} />
            </h3>
            <ul className="space-y-3 font-body font-bold text-sm uppercase tracking-wide">
              {[
                { label: 'Frames',   value: `${frameCount} / ${CAPTURE_FRAMES}`, ok: frameCount > 0 },
                { label: 'Progress', value: `${progress}%`,                      ok: progress > 0 },
                { label: 'Status',   value: state.toUpperCase(),                 ok: state !== 'error' },
              ].map(({ label, value, ok }) => (
                <li key={label} className="flex justify-between">
                  <span className="text-[#4a4a4a]">{label}:</span>
                  <span className={ok ? 'text-brutal-blue' : 'text-brutal-red'}>{value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Progress segments */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between font-display font-bold uppercase tracking-widest text-lg">
              <span>Capture</span>
              <span>{progress}%</span>
            </div>
            <div className="flex gap-2 h-12 w-full brutal-border p-2 bg-brutal-cream">
              {Array.from({ length: segments }).map((_, i) => (
                <div key={i} className={`h-full flex-1 border-2 border-brutal-ink ${
                  i < filledSegments - 1                             ? 'bg-brutal-ink' :
                  i === filledSegments - 1 && state === 'scanning'  ? 'bg-brutal-yellow border-brutal-yellow animate-pulse' :
                  i < filledSegments                                 ? 'bg-brutal-ink' :
                  'border-dashed'
                }`} />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-brutal-white brutal-border p-5">
            <h3 className="font-display font-bold text-sm uppercase brutal-border-b pb-2 mb-3 flex items-center gap-2">
              <Move size={14} /> Instructions
            </h3>
            <ol className="space-y-2 text-xs font-body text-[#4a4a4a]">
              {[
                'Press Begin Scan to start',
                'Position face within the oval',
                'Ensure good lighting on your face',
                'Look directly at the camera',
                'Hold still — 5 frames are captured',
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-display font-bold text-brutal-ink">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <div className="brutal-border-t pt-8">
        {state === 'idle' && (
          <button
            onClick={beginScan}
            className="w-full bg-brutal-yellow text-brutal-ink border-4 border-brutal-ink py-6 font-display font-bold text-3xl uppercase tracking-tight brutal-shadow-lg hover:bg-brutal-ink hover:text-brutal-yellow transition-colors flex items-center justify-center gap-4"
          >
            Begin Scan <Camera size={36} />
          </button>
        )}
        {isActive && (
          <button disabled className="w-full bg-brutal-surface text-brutal-ink border-4 border-brutal-ink py-6 font-display font-bold text-3xl uppercase tracking-tight brutal-shadow-lg opacity-60 flex items-center justify-center gap-4">
            {state === 'camera-starting' ? 'Starting Camera…' :
             state === 'scanning'        ? `Scanning · ${frameCount}/${CAPTURE_FRAMES}` :
             'Processing…'}
          </button>
        )}
        {(state === 'success' || state === 'error') && (
          <div className="space-y-4">
            {message && (
              <div className={`p-4 brutal-border font-display font-bold uppercase text-sm ${
                state === 'success' ? 'bg-[#0F8F3A] text-white' : 'bg-brutal-red text-white'
              }`}>
                {message}
              </div>
            )}
            {state === 'error' && (
              <button onClick={reset} className="w-full brutal-btn-secondary py-4 font-display font-bold text-lg flex items-center justify-center gap-3">
                <RotateCcw size={18} /> Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
