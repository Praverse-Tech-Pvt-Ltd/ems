'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Fingerprint, CheckCircle, AlertCircle, ArrowLeft, Sun, Move, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

type Mode  = 'face' | 'fingerprint';
type State = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface Telemetry { lighting: string; distance: string; angle: string; ok: boolean }

export default function BiometricPage() {
  const [mode, setMode]       = useState<Mode>('face');
  const [state, setState]     = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    lighting: 'Optimal', distance: '0.6 M', angle: '0°', ok: true,
  });
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setState('error');
      setMessage('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const beginScan = async () => {
    if (mode === 'face') await startCamera();
    setState('scanning');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        if (p === 40) setTelemetry({ lighting: 'Good', distance: '0.6 M', angle: '0°', ok: true });
        return p + 5;
      });
    }, 150);

    setTimeout(async () => {
      clearInterval(interval);
      setState('processing');
      try {
        await apiClient.post('/attendance/punch', { method: mode === 'face' ? 'FACE' : 'FINGERPRINT' });
        setState('success');
        setMessage('Attendance recorded successfully.');
      } catch {
        setState('error');
        setMessage('Recognition failed. Please try again.');
      } finally {
        stopCamera();
      }
    }, 4000);
  };

  const reset = () => {
    stopCamera();
    setState('idle');
    setMessage('');
    setProgress(0);
    setTelemetry({ lighting: 'Optimal', distance: '0.6 M', angle: '0°', ok: true });
  };

  const segments = 5;
  const filledSegments = Math.round((progress / 100) * segments);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between brutal-border-b pb-6">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Biometric<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Enrollment</span>
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <div className={`w-3 h-3 border-2 border-brutal-ink ${
              state === 'success' ? 'bg-brutal-yellow' :
              state === 'error'   ? 'bg-brutal-red' :
              state === 'scanning' || state === 'processing' ? 'bg-brutal-blue' :
              'bg-brutal-surface-dim'
            }`} />
            <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a]">
              Status: {
                state === 'idle'       ? 'Awaiting Subject' :
                state === 'scanning'   ? 'Scanning...' :
                state === 'processing' ? 'Processing...' :
                state === 'success'    ? 'Enrolled' :
                'Error'
              }
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

      {/* Mode toggle */}
      <div className="flex gap-0 brutal-border brutal-shadow w-fit">
        {(['face', 'fingerprint'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); reset(); }}
            className={`flex items-center gap-2 px-6 py-3 font-display font-bold text-sm uppercase tracking-wide transition-colors ${
              mode === m ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-white hover:bg-brutal-surface'
            } ${m === 'face' ? 'border-r-2 border-brutal-ink' : ''}`}
          >
            {m === 'face' ? <Camera size={16} /> : <Fingerprint size={16} />}
            {m === 'face' ? 'Face ID' : 'Fingerprint'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-start">
        {/* Scanner viewport */}
        <div className="relative aspect-square bg-brutal-ink border-4 border-brutal-ink brutal-shadow-lg overflow-hidden">
          {mode === 'face' && (
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover grayscale opacity-70" />
          )}
          {mode === 'fingerprint' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Fingerprint size={120} className="text-brutal-surface-dim opacity-30" />
            </div>
          )}

          {/* Corner brackets */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
            <div
              key={pos}
              className={`absolute w-12 h-12 border-[8px] border-brutal-yellow ${
                pos === 'tl' ? 'top-4 left-4 border-r-0 border-b-0' :
                pos === 'tr' ? 'top-4 right-4 border-l-0 border-b-0' :
                pos === 'bl' ? 'bottom-4 left-4 border-r-0 border-t-0' :
                               'bottom-4 right-4 border-l-0 border-t-0'
              }`}
            />
          ))}

          {/* HUD top */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
            <div className="bg-brutal-ink border-[3px] border-brutal-yellow px-3 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-yellow">
              {state === 'scanning' ? 'Scanning...' : state === 'processing' ? 'Processing...' : 'Standby'}
            </div>
            {state === 'scanning' && !telemetry.ok && (
              <div className="bg-brutal-ink border-[3px] border-brutal-red px-3 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-red flex items-center gap-1">
                <AlertCircle size={12} /> Align Face
              </div>
            )}
          </div>

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-1 bg-brutal-yellow" />
            <div className="absolute h-12 w-1 bg-brutal-yellow" />
            <div className="absolute w-40 h-56 border-[3px] border-brutal-yellow border-dashed opacity-50" />
          </div>

          {/* Scan line */}
          {(state === 'scanning' || state === 'processing') && (
            <div
              className="absolute left-0 right-0 h-1.5 bg-brutal-yellow z-20 transition-all duration-300"
              style={{ top: `${progress}%`, boxShadow: '0 0 20px rgba(255,204,0,1)' }}
            />
          )}

          {/* Success overlay */}
          {state === 'success' && (
            <div className="absolute inset-0 bg-brutal-yellow/90 flex flex-col items-center justify-center z-30">
              <CheckCircle size={64} className="text-brutal-ink mb-4" />
              <p className="font-display font-bold text-xl uppercase tracking-tight text-brutal-ink">Success!</p>
            </div>
          )}
          {state === 'error' && (
            <div className="absolute inset-0 bg-brutal-red/90 flex flex-col items-center justify-center z-30">
              <AlertCircle size={64} className="text-white mb-4" />
              <p className="font-display font-bold text-xl uppercase tracking-tight text-white">Failed</p>
            </div>
          )}

          {/* SEQ badge */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-brutal-ink border-[3px] border-brutal-blue px-4 py-1 font-display font-bold text-xs uppercase tracking-widest text-brutal-blue z-10">
            SEQ: 0x99F_ALPHA
          </div>
        </div>

        {/* Side controls */}
        <div className="flex flex-col gap-6 w-full md:w-72">
          {/* Telemetry */}
          <div className="bg-brutal-white brutal-border brutal-shadow p-5">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-2 mb-4 flex items-center justify-between">
              Telemetry <Sun size={16} />
            </h3>
            <ul className="space-y-3 font-body font-bold text-sm uppercase tracking-wide">
              {[
                { label: 'Lighting', value: telemetry.lighting, ok: telemetry.ok },
                { label: 'Distance', value: telemetry.distance, ok: true },
                { label: 'Angle',    value: telemetry.angle,    ok: true },
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
                <div
                  key={i}
                  className={`h-full flex-1 border-2 border-brutal-ink ${
                    i < filledSegments - 1 ? 'bg-brutal-ink' :
                    i === filledSegments - 1 && state === 'scanning' ? 'bg-brutal-yellow border-brutal-yellow animate-pulse' :
                    i < filledSegments ? 'bg-brutal-ink' :
                    'border-dashed'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-brutal-white brutal-border p-5">
            <h3 className="font-display font-bold text-sm uppercase brutal-border-b pb-2 mb-3 flex items-center gap-2">
              <Move size={14} /> Instructions
            </h3>
            <ol className="space-y-2 text-xs font-body text-[#4a4a4a]">
              {(mode === 'face' ? [
                'Position face within the frame',
                'Ensure good lighting on your face',
                'Look directly at the camera',
                'Hold still during capture',
              ] : [
                'Place finger on scanner pad',
                'Apply gentle, even pressure',
                'Hold still until complete',
                'Re-scan if prompted',
              ]).map((step, i) => (
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
            Begin Scan
            <Camera size={36} />
          </button>
        )}
        {(state === 'scanning' || state === 'processing') && (
          <button
            disabled
            className="w-full bg-brutal-surface text-brutal-ink border-4 border-brutal-ink py-6 font-display font-bold text-3xl uppercase tracking-tight brutal-shadow-lg opacity-60 flex items-center justify-center gap-4"
          >
            {state === 'scanning' ? 'Scanning...' : 'Processing...'}
          </button>
        )}
        {(state === 'success' || state === 'error') && (
          <div className="space-y-4">
            {message && (
              <div className={`p-4 brutal-border font-display font-bold uppercase text-sm ${
                state === 'success' ? 'bg-brutal-yellow text-brutal-ink' : 'bg-brutal-red text-white'
              }`}>
                {message}
              </div>
            )}
            <button
              onClick={reset}
              className="w-full brutal-btn-secondary py-4 font-display font-bold text-lg flex items-center justify-center gap-3"
            >
              <RotateCcw size={18} /> Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
