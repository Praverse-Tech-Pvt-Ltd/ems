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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions.');
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
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      ) : (
        <>
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="block"
              style={{ width, height }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-full border-2 border-dashed border-white/60"
                style={{ width: 180, height: 220 }}
              />
            </div>
            {!ready && (
              <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
                <span className="text-white text-sm">Starting camera…</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {!autoCapture && (
            <button
              onClick={handleManualCapture}
              disabled={!ready}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Capture Photo
            </button>
          )}
        </>
      )}
    </div>
  );
}
