'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Minimum 8 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  email:       z.string().email('Invalid email address'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirm:     z.string().min(8, 'Minimum 8 characters'),
}).refine((d) => d.newPassword === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type ForgotForm = z.infer<typeof forgotSchema>;

/* ── Decorative background SVG blobs ──────────────────────────────────────── */
function DecorBlobs() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id="g1" cx="30%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ffb59f" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffb59f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g2" cx="80%" cy="75%" r="50%">
          <stop offset="0%" stopColor="#89ceff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#89ceff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g3" cx="60%" cy="10%" r="40%">
          <stop offset="0%" stopColor="#dae2fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#dae2fd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g1)" />
      <rect width="100%" height="100%" fill="url(#g2)" />
      <rect width="100%" height="100%" fill="url(#g3)" />
    </svg>
  );
}

/* ── Dot grid overlay ──────────────────────────────────────────────────────── */
function DotGrid() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.18]"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#aa3000" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

/* ── Floating stat card ────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, className }: {
  icon: string; label: string; value: string; sub: string; className?: string;
}) {
  return (
    <div
      className={`absolute flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl ${className ?? ''}`}
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.9)',
        minWidth: '190px',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: 'linear-gradient(135deg,#aa3000,#d04411)' }}
      >
        <span className="text-white text-base">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5a4139]">{label}</p>
        <p className="text-base font-bold text-[#0b1c30] leading-tight">{value}</p>
        <p className="text-[10px] text-[#8e7068]">{sub}</p>
      </div>
    </div>
  );
}

/* ── Big abstract ring decoration ─────────────────────────────────────────── */
function RingDecor() {
  return (
    <>
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 420,
          height: 420,
          top: '50%',
          left: '50%',
          transform: 'translate(-55%, -48%)',
          border: '1.5px solid rgba(170,48,0,0.12)',
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 580,
          height: 580,
          top: '50%',
          left: '50%',
          transform: 'translate(-55%, -48%)',
          border: '1px solid rgba(0,98,141,0.08)',
        }}
      />
    </>
  );
}

/* ── Full-screen branded background (sits behind everything) ──────────────── */
function FullScreenBackdrop() {
  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #fef3ee 0%, #e5eeff 55%, #dce9ff 100%)' }}
    >
      <DecorBlobs />
      <DotGrid />
      <RingDecor />

      {/* Headline, anchored to the left so the card can float center/right */}
      <div className="hidden xl:block absolute left-16 top-1/2 -translate-y-1/2 max-w-md z-10">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5 text-[11px] font-semibold tracking-widest uppercase"
          style={{ background: 'rgba(170,48,0,0.08)', color: '#aa3000' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#aa3000] animate-pulse" />
          Internal Platform
        </div>
        <h2
          className="font-extrabold leading-[1.08] tracking-tight mb-4"
          style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)', color: '#0b1c30' }}
        >
          One place for<br />
          <span style={{ color: '#aa3000' }}>every</span> employee<br />
          workflow.
        </h2>
        <p className="text-sm text-[#5a4139] leading-relaxed max-w-xs mb-8">
          Attendance, payroll, expenses, leaves, and performance — all unified for NexGen Pharma teams.
        </p>

        <div className="relative h-44">
          <StatCard
            icon="📍"
            label="GPS Attendance"
            value="Geo-fenced"
            sub="Live location validation"
            className="top-0 left-0 rotate-[2deg]"
          />
          <StatCard
            icon="💰"
            label="Payroll"
            value="Auto-processed"
            sub="Slips + deductions"
            className="top-16 left-16 rotate-[-1.5deg]"
          />
          <StatCard
            icon="🔔"
            label="Alerts"
            value="Real-time"
            sub="Socket.io powered"
            className="top-32 left-4 rotate-[1deg]"
          />
        </div>
      </div>

      {/* Bottom-left tag */}
      <div className="hidden xl:block absolute left-16 bottom-8 z-10">
        <p className="text-[10px] text-[#8e7068] tracking-wider font-semibold uppercase">
          NexGen Pharma Solutions · Confidential
        </p>
      </div>
    </div>
  );
}

/* ── Shared input wrapper ──────────────────────────────────────────────────── */
function InputField({
  label, error, rightLabel, children,
}: {
  label: string; error?: string; rightLabel?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a4139]">
          {label}
        </label>
        {rightLabel}
      </div>
      {children}
      {error && <p className="text-xs text-[#ba1a1a] mt-1.5">{error}</p>}
    </div>
  );
}

const inputCls = [
  'w-full rounded-xl px-4 py-2.5 text-sm text-[#0b1c30] bg-white',
  'border border-[#e2bfb5] focus:outline-none focus:ring-2 focus:ring-[#aa3000]/25 focus:border-[#aa3000]',
  'transition-all duration-150 placeholder:text-[#c4a99e]',
].join(' ');

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [view, setView]           = useState<'login' | 'forgot'>('login');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const loginForm  = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onLogin = async (data: LoginForm) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/auth/login', data);
      setAuth(res.data.accessToken, res.data.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg ?? 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  const onForgot = async (data: ForgotForm) => {
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/forgot-password', { email: data.email, newPassword: data.newPassword });
      setResetDone(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg ?? 'Reset failed. Check your email and try again.');
    } finally { setLoading(false); }
  };

  /* shared error banner */
  const ErrorBanner = () => error ? (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-[#ffdad6] border border-[#ba1a1a]/20">
      <AlertCircle size={15} className="text-[#ba1a1a] flex-shrink-0 mt-0.5" />
      <span className="text-xs text-[#ba1a1a]">{error}</span>
    </div>
  ) : null;

  /* shared submit button */
  const SubmitBtn = ({ label, loadingLabel }: { label: string; loadingLabel: string }) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide shadow-lg
        hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
      style={{
        background: 'linear-gradient(135deg,#aa3000,#d04411)',
        boxShadow: '0 6px 20px rgba(170,48,0,0.35)',
      }}
    >
      {loading
        ? <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {loadingLabel}
          </span>
        : label
      }
    </button>
  );

  /* ── Centered card wrapper, floats over the full-screen backdrop ──────────── */
  const RightPanel = ({ children }: { children: React.ReactNode }) => (
    <div className="relative z-10 min-h-screen w-full flex items-center justify-center xl:justify-end px-6 py-12 xl:pr-24">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg,#aa3000,#d04411)' }}
          >
            <img src="/brand/nexgen-logo-mark.png" alt="NexGen" className="w-6 h-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0b1c30]">NexGen</div>
            <div className="text-[10px] text-[#8e7068] tracking-wider uppercase">Employee OS</div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(226,191,181,0.4)',
            boxShadow: '0 20px 60px rgba(11,28,48,0.12), 0 4px 16px rgba(11,28,48,0.08)',
          }}
        >
          {children}
        </div>

        <p className="text-center text-[11px] text-[#8e7068] mt-6 tracking-wide">
          NexGen Pharma Solutions · Internal use only
        </p>
      </div>
    </div>
  );

  /* ── Forgot password ─────────────────────────────────────────────────────── */
  if (view === 'forgot') {
    return (
      <div className="min-h-screen relative">
        <FullScreenBackdrop />
        <RightPanel>
          {resetDone ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl px-4 py-4 bg-[#d4edda] border border-emerald-200">
                <CheckCircle size={18} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Password reset!</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Your password has been updated. Sign in to continue.</p>
                </div>
              </div>
              <button
                onClick={() => { setView('login'); setResetDone(false); forgotForm.reset(); }}
                className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#aa3000,#d04411)', boxShadow: '0 6px 20px rgba(170,48,0,0.3)' }}
              >
                Go to sign in →
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => { setView('login'); setError(''); setResetDone(false); forgotForm.reset(); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#8e7068] hover:text-[#aa3000] mb-6 transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>

              <div className="mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(170,48,0,0.08)' }}
                >
                  <span className="text-xl">🔑</span>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight mb-1">Reset password</h1>
                <p className="text-sm text-[#5a4139]">Enter your email and choose a new password.</p>
              </div>

              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <InputField label="Email address" error={forgotForm.formState.errors.email?.message}>
                  <input {...forgotForm.register('email')} type="email" placeholder="you@nexgen.in" className={inputCls} />
                </InputField>
                <InputField label="New password" error={forgotForm.formState.errors.newPassword?.message}>
                  <input {...forgotForm.register('newPassword')} type="password" placeholder="••••••••" className={inputCls} />
                </InputField>
                <InputField label="Confirm new password" error={forgotForm.formState.errors.confirm?.message}>
                  <input {...forgotForm.register('confirm')} type="password" placeholder="••••••••" className={inputCls} />
                </InputField>
                <ErrorBanner />
                <SubmitBtn label="Reset password →" loadingLabel="Resetting…" />
              </form>
            </>
          )}
        </RightPanel>
      </div>
    );
  }

  /* ── Login ───────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen relative">
      <FullScreenBackdrop />

      <RightPanel>
        <div className="mb-7">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(170,48,0,0.08)' }}
          >
            <span className="text-xl">👋</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-[#5a4139]">Sign in to your employee portal</p>
        </div>

        <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
          <InputField label="Email address" error={loginForm.formState.errors.email?.message}>
            <input
              {...loginForm.register('email')}
              type="email"
              placeholder="you@nexgen.in"
              className={inputCls}
            />
          </InputField>

          <InputField
            label="Password"
            error={loginForm.formState.errors.password?.message}
            rightLabel={
              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); }}
                className="text-[11px] font-bold text-[#aa3000] hover:text-[#d04411] transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            }
          >
            <div className="relative">
              <input
                {...loginForm.register('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className={inputCls + ' pr-11'}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8e7068] hover:text-[#aa3000] transition-colors cursor-pointer"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </InputField>

          <ErrorBanner />

          <div className="pt-1">
            <SubmitBtn label="Sign in →" loadingLabel="Signing in…" />
          </div>
        </form>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mt-7 pt-6 border-t border-[#e2bfb5]/60">
          {['GPS Attendance', 'Auto Payroll', 'Leave Mgmt', 'Expenses'].map(f => (
            <span
              key={f}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(170,48,0,0.07)', color: '#aa3000' }}
            >
              {f}
            </span>
          ))}
        </div>
      </RightPanel>
    </div>
  );
}
