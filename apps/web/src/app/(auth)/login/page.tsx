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

/* ── Shared input classes ────────────────────────────────────────────────── */
const inputCls =
  'w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm ' +
  'text-on-surface placeholder:text-on-surface-variant/50 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-container/40 focus:border-primary-container/60 ' +
  'transition-all duration-150';

const labelCls = 'block text-xs font-semibold text-on-surface-variant mb-1.5 tracking-wide';

/* ── Brand side panel ────────────────────────────────────────────────────── */
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between w-[420px] bg-inverse-surface flex-shrink-0 p-10">
      {/* Logo */}
      <div>
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shadow-md">
            <img
              src="/brand/nexgen-logo-mark.png"
              alt="NexGen"
              className="w-6 h-6 object-contain brightness-0 invert"
            />
          </div>
          <div>
            <div className="text-base font-bold text-inverse-on-surface tracking-tight">NexGen</div>
            <div className="text-[10px] text-inverse-on-surface/50 font-medium tracking-wider">Employee OS</div>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-inverse-on-surface leading-tight tracking-tight mb-4">
          Employee<br />Management<br />System
        </h2>
        <p className="text-sm text-inverse-on-surface/50 leading-relaxed">
          Unified platform for attendance, payroll, expenses,
          invoicing, and leave management.
        </p>
      </div>

      {/* Feature list */}
      <div className="space-y-5">
        {[
          { icon: Shield, label: 'GPS Attendance',     detail: 'Geo-fenced location validation' },
          { icon: Zap,    label: 'Payroll Automation', detail: 'Automated salary slips & deductions' },
          { icon: Bell,   label: 'Real-time Alerts',   detail: 'Instant notifications via Socket.io' },
        ].map(({ icon: Icon, label, detail }) => (
          <div key={label} className="flex items-start gap-4 pt-5 border-t border-inverse-on-surface/10">
            <div className="w-8 h-8 rounded-lg bg-inverse-on-surface/10 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-primary-fixed-dim" />
            </div>
            <div>
              <p className="text-sm font-semibold text-inverse-on-surface">{label}</p>
              <p className="text-xs text-inverse-on-surface/40 mt-0.5">{detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-inverse-on-surface/30 font-medium tracking-wider">
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
      <div className="min-h-screen flex bg-surface">
        <BrandPanel />
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <button
              onClick={() => { setView('login'); setError(''); setResetDone(false); forgotForm.reset(); }}
              className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface mb-10 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>

            {resetDone ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                  <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Password reset</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Your password has been updated. You can now sign in.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setView('login'); setResetDone(false); forgotForm.reset(); }}
                  className="w-full py-2.5 rounded-full bg-primary-container text-on-primary text-sm font-semibold shadow-sm hover:bg-primary transition-all cursor-pointer"
                >
                  Go to sign in →
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-1">Reset password</h1>
                <p className="text-sm text-on-surface-variant mb-8">
                  Enter your email and choose a new password
                </p>

                <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                  <div>
                    <label className={labelCls}>Email address</label>
                    <input {...forgotForm.register('email')} type="email" placeholder="you@nexgen.in" className={inputCls} />
                    {forgotForm.formState.errors.email && (
                      <p className="text-xs text-error mt-1">{forgotForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>New password</label>
                    <input {...forgotForm.register('newPassword')} type="password" placeholder="••••••••" className={inputCls} />
                    {forgotForm.formState.errors.newPassword && (
                      <p className="text-xs text-error mt-1">{forgotForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Confirm new password</label>
                    <input {...forgotForm.register('confirm')} type="password" placeholder="••••••••" className={inputCls} />
                    {forgotForm.formState.errors.confirm && (
                      <p className="text-xs text-error mt-1">{forgotForm.formState.errors.confirm.message}</p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 bg-error-container border border-error/20 rounded-lg px-4 py-3">
                      <AlertCircle size={15} className="text-error flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-on-error-container">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-full bg-primary-container text-on-primary text-sm font-semibold shadow-sm hover:bg-primary transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
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
    <div className="min-h-screen flex bg-surface">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center">
              <img src="/brand/nexgen-logo-mark.png" alt="NexGen" className="w-5 h-5 object-contain brightness-0 invert" />
            </div>
            <div>
              <div className="text-sm font-bold text-on-surface">NexGen</div>
              <div className="text-[10px] text-on-surface-variant">Employee OS</div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-on-surface-variant mb-8">Sign in to your employee portal</p>

          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            {/* Email */}
            <div>
              <label className={labelCls}>Email address</label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="you@nexgen.in"
                className={inputCls}
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-error mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls.replace(' mb-1.5', '')}>Password</label>
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); }}
                  className="text-xs font-semibold text-primary-container hover:text-primary transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-xs text-error mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-error-container border border-error/20 rounded-lg px-4 py-3">
                <AlertCircle size={15} className="text-error flex-shrink-0 mt-0.5" />
                <span className="text-xs text-on-error-container">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 rounded-full bg-primary-container text-on-primary text-sm font-semibold shadow-sm hover:bg-primary transition-all disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
            >
              {loading
                ? <span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Signing in…</span>
                : 'Sign in →'
              }
            </button>
          </form>

          <p className="text-center text-xs text-on-surface-variant/50 mt-10">
            NexGen Pharma Solutions · Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
