'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Eye, EyeOff, ArrowLeft, CheckCircle, Shield, Zap, Bell } from 'lucide-react';

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

function InputField({
  label,
  error,
  rightLabel,
  children,
}: {
  label: string;
  error?: string;
  rightLabel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-display font-700 text-ink-secondary uppercase tracking-[0.12em]">
          {label}
        </label>
        {rightLabel}
      </div>
      {children}
      {error && (
        <p className="text-xs text-rose mt-1.5 font-body">{error}</p>
      )}
    </div>
  );
}

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between w-[400px] flex-shrink-0 p-10 relative overflow-hidden"
      style={{ background: 'var(--color-panel-bg)' }}
    >
      {/* Gradient mesh background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 40%, rgba(214,88,15,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(15,143,166,0.08) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-14">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <img
              src="/brand/nexgen-logo-mark.png"
              alt="NexGen"
              className="w-6 h-6 object-contain brightness-0 invert"
            />
          </div>
          <div>
            <div className="font-display font-700 text-base text-white leading-tight">NexGen</div>
            <div className="text-[10px] tracking-widest uppercase font-body" style={{ color: 'var(--color-panel-text-dim)' }}>Employee OS</div>
          </div>
        </div>

        <h2 className="font-display font-800 text-[2.6rem] text-white leading-[1.05] tracking-tight mb-4">
          Employee<br />Management<br />System
        </h2>
        <p className="text-sm font-body leading-relaxed" style={{ color: 'var(--color-panel-text)' }}>
          Unified platform for attendance, payroll, expenses, invoicing, and leave management.
        </p>
      </div>

      {/* Feature list */}
      <div className="relative z-10 space-y-4">
        {[
          { icon: Shield, label: 'GPS Attendance',     detail: 'Geo-fenced location validation' },
          { icon: Zap,    label: 'Payroll Automation', detail: 'Automated salary slips & deductions' },
          { icon: Bell,   label: 'Real-time Alerts',   detail: 'Instant notifications via Socket.io' },
        ].map(({ icon: Icon, label, detail }, i) => (
          <div
            key={label}
            className="flex items-start gap-4 pt-4"
            style={{ borderTop: i === 0 ? '1px solid var(--color-panel-border)' : '1px solid var(--color-panel-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-panel-border)' }}
            >
              <Icon size={15} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="text-sm font-display font-700 text-white">{label}</p>
              <p className="text-[11px] font-body mt-0.5" style={{ color: 'var(--color-panel-text)' }}>{detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="relative z-10 text-[10px] font-body tracking-wider" style={{ color: 'var(--color-panel-text-dim)' }}>
        NexGen Pharma Solutions · Internal Use Only
      </p>
    </div>
  );
}

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

  const inputCls =
    'w-full rounded-lg px-4 py-2.5 text-sm font-body text-ink transition-all duration-150 focus:outline-none';
  const inputStyle = {
    background: 'var(--color-canvas)',
    border: '1.5px solid var(--color-border)',
  };

  const onLogin = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/login', data);
      setAuth(res.data.accessToken, res.data.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async (data: ForgotForm) => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/forgot-password', {
        email: data.email,
        newPassword: data.newPassword,
      });
      setResetDone(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg ?? 'Reset failed. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Forgot / Reset view ──────────────────────────────────────────────── */
  if (view === 'forgot') {
    return (
      <div className="min-h-screen flex bg-canvas">
        <BrandPanel />
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <button
              onClick={() => { setView('login'); setError(''); setResetDone(false); forgotForm.reset(); }}
              className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink mb-10 transition-colors cursor-pointer font-body"
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>

            {resetDone ? (
              <div className="space-y-6">
                <div
                  className="flex items-start gap-3 rounded-xl px-5 py-4"
                  style={{ background: 'var(--color-emerald-light)', border: '1px solid rgba(5,150,105,0.2)' }}
                >
                  <CheckCircle size={18} style={{ color: 'var(--color-emerald)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-display font-700" style={{ color: 'var(--color-emerald)' }}>Password reset</p>
                    <p className="text-xs font-body mt-0.5" style={{ color: 'var(--color-emerald)' }}>
                      Your password has been updated. You can now sign in.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setView('login'); setResetDone(false); forgotForm.reset(); }}
                  className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-display font-700 shadow-sm hover:bg-primary-dim transition-all cursor-pointer"
                >
                  Go to sign in →
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-display font-800 text-ink tracking-tight mb-1">Reset password</h1>
                <p className="text-sm text-ink-muted font-body mb-8">Enter your email and choose a new password</p>

                <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                  <InputField label="Email address" error={forgotForm.formState.errors.email?.message}>
                    <input {...forgotForm.register('email')} type="email" placeholder="you@nexgen.in" className={inputCls} style={inputStyle} />
                  </InputField>
                  <InputField label="New password" error={forgotForm.formState.errors.newPassword?.message}>
                    <input {...forgotForm.register('newPassword')} type="password" placeholder="••••••••" className={inputCls} style={inputStyle} />
                  </InputField>
                  <InputField label="Confirm new password" error={forgotForm.formState.errors.confirm?.message}>
                    <input {...forgotForm.register('confirm')} type="password" placeholder="••••••••" className={inputCls} style={inputStyle} />
                  </InputField>

                  {error && (
                    <div
                      className="flex items-start gap-3 rounded-lg px-4 py-3"
                      style={{ background: 'var(--color-rose-light)', border: '1px solid rgba(225,29,72,0.2)' }}
                    >
                      <AlertCircle size={15} style={{ color: 'var(--color-rose)' }} className="flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-body" style={{ color: 'var(--color-rose)' }}>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-display font-700 shadow-sm hover:bg-primary-dim transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
                  >
                    {loading
                      ? <span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Resetting…</span>
                      : 'Reset password →'
                    }
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Login view ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-canvas">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <img src="/brand/nexgen-logo-mark.png" alt="NexGen" className="w-5 h-5 object-contain brightness-0 invert" />
            </div>
            <div>
              <div className="text-sm font-display font-700 text-ink">NexGen</div>
              <div className="text-[10px] text-ink-muted font-body">Employee OS</div>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-display font-800 text-ink tracking-tight mb-1">Welcome back</h1>
            <p className="text-sm text-ink-muted font-body">Sign in to your employee portal</p>
          </div>

          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <InputField label="Email address" error={loginForm.formState.errors.email?.message}>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="you@nexgen.in"
                className={inputCls}
                style={inputStyle}
              />
            </InputField>

            <InputField
              label="Password"
              error={loginForm.formState.errors.password?.message}
              rightLabel={
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); }}
                  className="text-[11px] font-display font-700 transition-colors cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
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
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </InputField>

            {error && (
              <div
                className="flex items-start gap-3 rounded-lg px-4 py-3"
                style={{ background: 'var(--color-rose-light)', border: '1px solid rgba(225,29,72,0.2)' }}
              >
                <AlertCircle size={15} style={{ color: 'var(--color-rose)' }} className="flex-shrink-0 mt-0.5" />
                <span className="text-xs font-body" style={{ color: 'var(--color-rose)' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 rounded-lg bg-primary text-white text-sm font-display font-700 shadow-sm hover:bg-primary-dim transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
              style={{ boxShadow: '0 4px 12px rgba(214,88,15,0.3)' }}
            >
              {loading
                ? <span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Signing in…</span>
                : 'Sign in →'
              }
            </button>
          </form>

          <p className="text-center text-xs text-ink-faint font-body mt-10">
            NexGen Pharma Solutions · Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
