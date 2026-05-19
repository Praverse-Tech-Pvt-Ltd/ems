'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { WebcamCapture } from '@/components/WebcamCapture';
import Link from 'next/link';

type Mode = 'check-in' | 'check-out';
type Status = 'scanning' | 'loading' | 'success' | 'error';

interface AttendanceResult {
  employeeId: string;
  confidence?: number;
  checkIn?: string;
  checkOut?: string;
  message: string;
}

export default function FaceAttendancePage() {
  const [mode, setMode] = useState<Mode>('check-in');
  const [checkOutEmployeeId, setCheckOutEmployeeId] = useState('');
  const [status, setStatus] = useState<Status>('scanning');
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCapture = useCallback(
    async (imageBase64: string) => {
      if (status === 'loading') return;
      setStatus('loading');
      setResult(null);
      setErrorMsg('');

      try {
        let endpoint = '/api/attendance/face/check-in';
        const body: Record<string, string> = { imageBase64 };

        if (mode === 'check-out') {
          if (!checkOutEmployeeId.trim()) {
            setErrorMsg('Enter employee ID for check-out');
            setStatus('error');
            setTimeout(() => setStatus('scanning'), 3000);
            return;
          }
          endpoint = '/api/attendance/face/check-out';
          body.employeeId = checkOutEmployeeId.trim();
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'Request failed');

        setResult(data);
        setStatus('success');
        setTimeout(() => setStatus('scanning'), 4000);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
        setStatus('error');
        setTimeout(() => setStatus('scanning'), 3000);
      }
    },
    [mode, checkOutEmployeeId, status],
  );

  const confidencePct = result?.confidence ? Math.round(result.confidence * 100) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between brutal-border-b pb-6">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Face<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Attendance</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Look at the camera to mark your attendance
          </p>
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
        {(['check-in', 'check-out'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setStatus('scanning'); setResult(null); }}
            className={`px-6 py-3 font-display font-bold text-sm uppercase tracking-wide transition-colors ${
              mode === m
                ? 'bg-brutal-ink text-brutal-yellow'
                : 'bg-brutal-cream text-brutal-ink hover:bg-brutal-surface'
            }`}
          >
            {m === 'check-in' ? 'Check In' : 'Check Out'}
          </button>
        ))}
      </div>

      {/* Check-out employee ID */}
      {mode === 'check-out' && (
        <div className="brutal-border brutal-shadow p-5 bg-brutal-white space-y-2">
          <label className="block font-display font-bold text-sm uppercase tracking-widest text-brutal-ink">
            Employee ID
          </label>
          <input
            type="text"
            value={checkOutEmployeeId}
            onChange={(e) => setCheckOutEmployeeId(e.target.value)}
            placeholder="e.g. EMP-001"
            className="w-full brutal-border px-4 py-3 font-body text-sm bg-brutal-cream focus:outline-none focus:ring-2 focus:ring-brutal-blue"
          />
        </div>
      )}

      {/* Camera */}
      <div className="relative brutal-border brutal-shadow-lg bg-brutal-ink p-4">
        <WebcamCapture
          onCapture={handleCapture}
          autoCapture={status === 'scanning'}
          captureInterval={3000}
          width={440}
          height={330}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded">
            <div className="text-center text-white">
              <div className="w-10 h-10 border-4 border-brutal-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="font-display font-bold text-xs tracking-widest uppercase">Recognizing…</p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className={`brutal-border p-4 flex items-center gap-3 ${
        status === 'success' ? 'bg-[#0F8F3A] text-white' :
        status === 'error'   ? 'bg-brutal-red text-white' :
        'bg-brutal-cream text-brutal-ink'
      }`}>
        {status === 'success' && <CheckCircle size={20} />}
        {status === 'error'   && <XCircle size={20} />}
        <div>
          {status === 'success' && result && (
            <>
              <p className="font-display font-bold text-sm uppercase">
                {mode === 'check-in' ? 'Checked In' : 'Checked Out'} — {result.employeeId}
              </p>
              {confidencePct && (
                <p className="text-xs opacity-80">Confidence: {confidencePct}%</p>
              )}
              {result.checkIn && (
                <p className="text-xs opacity-80">
                  Time: {new Date(result.checkIn).toLocaleTimeString()}
                </p>
              )}
            </>
          )}
          {status === 'error' && (
            <p className="font-display font-bold text-sm uppercase">{errorMsg || 'Recognition failed'}</p>
          )}
          {status === 'scanning' && (
            <p className="font-display font-bold text-sm uppercase tracking-widest animate-pulse">
              Scanning — please face the camera
            </p>
          )}
          {status === 'loading' && (
            <p className="font-display font-bold text-sm uppercase tracking-widest">Processing…</p>
          )}
        </div>
      </div>
    </div>
  );
}
