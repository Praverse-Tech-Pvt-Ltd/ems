'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface WebcamCaptureProps {
  onCapture: (imageBase64: string) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  width?: number;
  height?: number;
}

export function WebcamCapture({
  onCapture,
  autoCapture = false,
  captureInterval = 3000,
  width = 480,
  height = 360,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available. Open the app at http://localhost:3000 — browsers block camera on non-HTTPS/non-localhost URLs.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera found. Plug in a webcam and try again.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('Camera is in use by another app. Close Teams, Zoom, etc. and try again.');
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Permission denied. Click the camera icon in the address bar, allow access, then refresh.');
      } else {
        setError(`Camera error (${name || 'unknown'}). Ensure the app is open at localhost:3000.`);
      }
    }
  }, [width, height]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [ready]);

  const handleManualCapture = useCallback(() => {
    const image = capture();
    if (image) onCapture(image);
  }, [capture, onCapture]);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  useEffect(() => {
    if (!autoCapture || !ready) return;
    intervalRef.current = setInterval(() => {
      const image = capture();
      if (image) onCapture(image);
    }, captureInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoCapture, ready, capture, onCapture, captureInterval]);

  return (
    <div className="flex flex-col items-center gap-4">
      {error ? (
        <div className="w-full brutal-border bg-brutal-red text-white px-4 py-3 font-display font-bold text-xs uppercase tracking-widest">
          {error}
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden brutal-border" style={{ width, height }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="block w-full h-full object-cover scale-x-[-1]"
              style={{ width, height }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-36 h-48 border-[3px] border-dashed border-brutal-yellow rounded-full opacity-70" />
            </div>
            {!ready && (
              <div className="absolute inset-0 bg-brutal-ink/80 flex items-center justify-center">
                <span className="font-display font-bold text-xs tracking-widest text-brutal-cream uppercase">
                  Starting camera…
                </span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {!autoCapture && (
            <button
              onClick={handleManualCapture}
              disabled={!ready}
              className="brutal-btn-primary px-6 py-3 text-sm disabled:opacity-50"
            >
              Capture Photo
            </button>
          )}
        </>
      )}
    </div>
  );
}
