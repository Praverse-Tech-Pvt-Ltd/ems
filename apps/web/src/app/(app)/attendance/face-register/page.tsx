'use client';

import { useState } from 'react';
import { Camera, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { WebcamCapture } from '@/components/WebcamCapture';
import Link from 'next/link';

type Status = 'idle' | 'capturing' | 'loading' | 'success' | 'error';

export default function FaceRegisterPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = (imageBase64: string) => {
    setCapturedImage(imageBase64);
    setStatus('capturing');
  };

  const handleRegister = async () => {
    if (!employeeId.trim()) {
      setMessage('Please enter an employee ID');
      setStatus('error');
      return;
    }
    if (!capturedImage) {
      setMessage('Please capture a photo first');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim(), imageBase64: capturedImage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Registration failed');
      setStatus('success');
      setMessage(`Face registered successfully for employee ${employeeId}`);
      setCapturedImage(null);
      setEmployeeId('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const reset = () => {
    setStatus('idle');
    setMessage('');
    setCapturedImage(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between brutal-border-b pb-6">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Face ID<br />
            <span className="text-brutal-blue" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Register</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Enrol an employee's face for attendance recognition
          </p>
        </div>
        <Link
          href="/attendance"
          className="brutal-border p-2 bg-brutal-cream hover:bg-brutal-ink hover:text-brutal-yellow transition-colors brutal-shadow"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Employee ID */}
      <div className="bg-brutal-white brutal-border brutal-shadow p-6 space-y-3">
        <label className="block font-display font-bold text-sm uppercase tracking-widest text-brutal-ink">
          Employee ID
        </label>
        <input
          type="text"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          placeholder="e.g. EMP-001"
          className="w-full brutal-border px-4 py-3 font-body text-sm bg-brutal-cream focus:outline-none focus:ring-2 focus:ring-brutal-blue"
        />
      </div>

      {/* Camera / result */}
      {status === 'success' ? (
        <div className="brutal-border p-6 bg-[#0F8F3A] text-white flex items-center gap-4">
          <CheckCircle size={32} />
          <div>
            <p className="font-display font-bold text-lg uppercase">{message}</p>
            <button onClick={reset} className="text-sm underline mt-1 opacity-80 hover:opacity-100">
              Register another employee
            </button>
          </div>
        </div>
      ) : capturedImage ? (
        <div className="space-y-4">
          <div className="brutal-border brutal-shadow overflow-hidden">
            <img src={capturedImage} alt="Captured face" className="w-full" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 brutal-border py-3 font-display font-bold text-sm uppercase tracking-wide hover:bg-brutal-surface transition-colors"
            >
              Retake
            </button>
            <button
              onClick={handleRegister}
              disabled={status === 'loading'}
              className="flex-1 bg-brutal-yellow text-brutal-ink brutal-border py-3 font-display font-bold text-sm uppercase tracking-wide brutal-shadow hover:bg-brutal-ink hover:text-brutal-yellow transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? 'Registering…' : 'Register Face'}
            </button>
          </div>
        </div>
      ) : (
        <div className="brutal-border brutal-shadow p-6 flex justify-center bg-brutal-ink">
          <WebcamCapture onCapture={handleCapture} width={400} height={300} />
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="brutal-border p-4 bg-brutal-red text-white flex items-center gap-3">
          <AlertCircle size={20} />
          <span className="font-display font-bold text-sm uppercase">{message}</span>
        </div>
      )}

      {/* Instructions */}
      {status === 'idle' && !capturedImage && (
        <div className="brutal-border p-5 bg-brutal-white space-y-3">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest brutal-border-b pb-2 flex items-center gap-2">
            <Camera size={14} /> Instructions
          </h3>
          <ol className="space-y-2 font-body text-xs text-[#4a4a4a]">
            {[
              'Enter the employee ID above',
              'Position the employee's face within the oval guide',
              'Ensure good, even lighting on the face',
              'Click "Capture Photo" when ready',
              'Review the image, then click "Register Face"',
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-display font-bold text-brutal-ink">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
