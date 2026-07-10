'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Eye, EyeOff, ArrowLeft, CheckCircle, MapPin, Wallet, Bell, BarChart2 } from 'lucide-react';

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

/* ── Shared input wrapper ────────────────────────────────────────── */
function InputField({
  label, error, rightLabel, children,
}: {
  label: string; error?: string; rightLabel?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12.5px] font-semibold text-on-surface tracking-wide">{label}</label>
        {rightLabel}
      </div>
      <div
        className="rounded-xl transition-all duration-200"
        style={{ background: 'rgba(242,243,255,0.8)' }}
      >
        {children}
      </div>
      {error && (
        <p className="text-[11.5px] text-error mt-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>error</span>
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = [
  'w-full rounded-xl px-4 py-[10px] text-[13.5px] text-on-surface bg-transparent',
  'border border-card-border/70',
  'focus:outline-none focus:border-secondary focus:shadow-[0_0_0_3px_rgba(1,103,125,0.12)]',
  'transition-all duration-200 placeholder:text-on-surface-variant/40',
].join(' ');

/* ── Brand panel (left, dark navy) ──────────────────────────────── */
const FEATURES = [
  { Icon: MapPin,    label: 'GPS Attendance',    desc: 'Geo-fenced punch-in with location verification' },
  { Icon: Wallet,    label: 'Payroll Automation', desc: 'Automated salary slips and deduction tracking' },
  { Icon: Bell,      label: 'Real-time Alerts',   desc: 'Instant notifications via Socket.io' },
  { Icon: BarChart2, label: 'Analytics & Reports',desc: 'Comprehensive workforce intelligence dashboards' },
];

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between flex-shrink-0 p-12 relative overflow-hidden"
      style={{ width: 440, background: 'linear-gradient(150deg, #18253d 0%, #1e2c47 40%, #162035 100%)' }}
    >
      {/* Mesh gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl opacity-60"
          style={{ width: 320, height: 320, top: -100, right: -80, background: 'radial-gradient(circle, rgba(170,48,0,0.25) 0%, transparent 70%)' }}
        />
        <div
          className="absolute rounded-full blur-3xl opacity-50"
          style={{ width: 280, height: 280, bottom: 20, left: -80, background: 'radial-gradient(circle, rgba(1,103,125,0.22) 0%, transparent 70%)' }}
        />
        <div
          className="absolute rounded-full blur-2xl opacity-30"
          style={{ width: 180, height: 180, top: '45%', right: '20%', background: 'radial-gradient(circle, rgba(255,181,159,0.15) 0%, transparent 70%)' }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Logo + headline */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-[10px] flex-shrink-0 shadow-lg overflow-hidden"
            style={{ boxShadow: '0 4px 16px rgba(170,48,0,0.4)' }}
          >
            <Image src="/brand/nexgen-logo-mark.png" alt="NexGen" width={40} height={40} className="w-full h-full object-cover" priority />
          </div>
          <div>
            <div className="text-[#eef0ff] font-bold text-[17px] leading-tight tracking-tight">NexGen Pharma</div>
            <div className="text-[rgba(238,240,255,0.45)] text-[11px] font-medium mt-0.5 tracking-wide">
              Employee Management System
            </div>
          </div>
        </div>

        <h2
          className="font-bold leading-[1.12] tracking-tight mb-5"
          style={{ fontSize: 'clamp(1.8rem,2.6vw,2.3rem)', color: '#ffffff', letterSpacing: '-0.02em' }}
        >
          Manage your<br />workforce,<br />
          <span style={{ color: '#ffb59f' }}>
            effortlessly.
          </span>
        </h2>
        <p className="text-[rgba(238,240,255,0.50)] text-[14.5px] leading-relaxed">
          A unified platform for attendance, payroll, expenses, and leave management.
        </p>
      </div>

      {/* Feature list */}
      <div className="relative z-10">
        {FEATURES.map(({ Icon, label, desc }, i) => (
          <div
            key={i}
            className="flex items-start gap-3.5 pt-4 mt-4"
            style={{ borderTop: '1px solid rgba(238,240,255,0.07)' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'rgba(255,181,159,0.12)', border: '1px solid rgba(255,181,159,0.12)' }}
            >
              <Icon size={14} color="#ffb59f" />
            </div>
            <div>
              <div className="text-[#eef0ff] text-[13px] font-semibold mb-0.5 leading-tight">{label}</div>
              <div className="text-[rgba(238,240,255,0.40)] text-[11.5px] leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}

        <div
          className="flex items-center gap-2 mt-8 pt-4"
          style={{ borderTop: '1px solid rgba(238,240,255,0.07)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#ffb59f] opacity-60" />
          <p className="text-[10px] text-[rgba(238,240,255,0.30)] tracking-widest font-medium uppercase">
            NexGen Pharma Solutions · Confidential
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Shared submit button ────────────────────────────────────────── */
function SubmitBtn({ label, loadingLabel, loading }: { label: string; loadingLabel: string; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-[11px] min-h-[44px] rounded-xl text-white text-[13.5px] font-bold tracking-wide
        hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(170,48,0,0.38)]
        active:translate-y-0 active:scale-[0.98]
        transition-all duration-150
        disabled:opacity-60 disabled:pointer-events-none disabled:translate-y-0 cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, #aa3000 0%, #c84010 60%, #d04a18 100%)',
        boxShadow: '0 4px 16px rgba(170,48,0,0.32), 0 1px 0 rgba(255,255,255,0.12) inset',
      }}
    >
      {loading
        ? <span className="inline-flex items-center gap-2 justify-center">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {loadingLabel}
          </span>
        : label
      }
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const router  = useRouter();
  const queryClient = useQueryClient();
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
      queryClient.clear();
      setAuth(res.data.accessToken, res.data.user);
      router.push('/employee-my-workday');
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

  const ErrorBanner = () => error ? (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-error-container border border-error/20">
      <AlertCircle size={15} className="text-error flex-shrink-0 mt-0.5" />
      <span className="text-xs text-on-error-container">{error}</span>
    </div>
  ) : null;

  /* ── Forgot password ─────────────────────────────────────────── */
  if (view === 'forgot') {
    return (
      <div className="min-h-[100dvh] flex bg-surface">
        <BrandPanel />
        <div className="flex-1 flex items-center justify-center px-8 py-12 bg-surface">
          <div className="w-full max-w-[400px] fade-up">
            <button
              onClick={() => { setView('login'); setError(''); setResetDone(false); forgotForm.reset(); }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-secondary mb-10 py-2 -my-2 transition-colors cursor-pointer"
            >
              <ArrowLeft size={15} /> Back to sign in
            </button>

            {resetDone ? (
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-full bg-[#d1fae5] flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={26} color="#059669" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-2">Password reset</h2>
                  <p className="text-sm text-on-surface-variant">Your password has been updated. Sign in to continue.</p>
                </div>
                <button
                  onClick={() => { setView('login'); setResetDone(false); forgotForm.reset(); }}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-bold tracking-wide cursor-pointer"
                  style={{ background: 'linear-gradient(135deg,#aa3000,#d04411)', boxShadow: '0 6px 20px rgba(170,48,0,0.3)' }}
                >
                  Go to sign in →
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(170,48,0,0.08)' }}
                  >
                    <span className="text-xl">🔑</span>
                  </div>
                  <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1">Reset password</h1>
                  <p className="text-sm text-on-surface-variant">Enter your email and choose a new password.</p>
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
                  <SubmitBtn label="Reset password →" loadingLabel="Resetting…" loading={loading} />
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Login ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] flex bg-surface">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-surface">
        <div className="w-full max-w-[400px] fade-up">
          {/* Card */}
          <div
            className="rounded-2xl p-8 shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(226,191,181,0.4)',
              boxShadow: '0 20px 60px rgba(19,27,46,0.12), 0 4px 16px rgba(19,27,46,0.08)',
            }}
          >
            {/* Logo in card (shown on mobile when brand panel is hidden) */}
            <div className="flex items-center gap-3 mb-7 lg:hidden">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm">
                <Image src="/brand/nexgen-logo-mark.png" alt="NexGen" width={36} height={36} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-sm font-bold text-on-surface">NexGen</div>
                <div className="text-[10px] text-on-surface-variant tracking-wider uppercase">Employee OS</div>
              </div>
            </div>

            <div className="mb-7">
              <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1">Welcome back</h1>
              <p className="text-sm text-on-surface-variant">Sign in to your employee portal</p>
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
                    className="min-h-11 px-1 text-[12px] font-semibold text-secondary hover:text-on-surface transition-colors cursor-pointer"
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
                    className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </InputField>

              <ErrorBanner />

              <div className="pt-1">
                <SubmitBtn label="Sign in →" loadingLabel="Signing in…" loading={loading} />
              </div>
            </form>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-card-border">
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
          </div>

          <p className="text-center text-[11px] text-on-surface-variant/60 mt-5 tracking-wide">
            NexGen Pharma Solutions · Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
