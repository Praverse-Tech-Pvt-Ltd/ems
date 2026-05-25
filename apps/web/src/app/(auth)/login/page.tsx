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
  email:    z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  email:      z.string().email('Invalid email'),
  newPassword: z.string().min(8, 'Min 8 characters'),
  confirm:    z.string().min(8, 'Min 8 characters'),
}).refine((d) => d.newPassword === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type ForgotForm = z.infer<typeof forgotSchema>;

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [view, setView]         = useState<'login' | 'forgot'>('login');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onLogin = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/login', data);
      // refreshToken is now set as an httpOnly cookie by the server.
      // We only keep the short-lived accessToken in memory.
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

  const brandPanel = (
    <div className="hidden lg:flex flex-col justify-between w-[420px] bg-brutal-ink brutal-border-r flex-shrink-0 p-12">
      <div>
        <div className="mb-12">
          <h1 className="font-display font-bold text-3xl text-brutal-yellow uppercase tracking-tighter leading-none">
            NexGen<br />Pharma
          </h1>
          <div className="inline-block bg-brutal-yellow text-brutal-ink text-xs font-display font-bold px-2 py-1 mt-2 uppercase tracking-widest">
            EMS
          </div>
        </div>
        <h2 className="font-display font-bold text-5xl text-white uppercase leading-none tracking-tighter mb-6">
          Employee<br />Management<br />System
        </h2>
        <p className="font-body text-white/50 text-sm leading-relaxed font-bold uppercase tracking-wide">
          Unified platform for attendance, payroll, expenses, invoicing, and leave management.
        </p>
      </div>
      <div className="space-y-4">
        {[
          { label: 'Biometric Attendance', detail: 'Face recognition + GPS geo-fencing' },
          { label: 'Payroll Automation',   detail: 'Automated salary slips and deductions' },
          { label: 'Real-time Alerts',     detail: 'Instant notifications via Socket.io' },
        ].map(({ label, detail }) => (
          <div key={label} className="flex items-start gap-4 brutal-border-t pt-4">
            <div className="w-2 h-2 bg-brutal-yellow mt-1.5 flex-shrink-0" />
            <div>
              <p className="font-display font-bold text-white text-sm uppercase tracking-wide">{label}</p>
              <p className="font-body text-white/40 text-xs mt-0.5">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (view === 'forgot') {
    return (
      <div className="min-h-screen flex bg-brutal-cream">
        {brandPanel}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-md">
            <button
              onClick={() => { setView('login'); setError(''); setResetDone(false); forgotForm.reset(); }}
              className="flex items-center gap-2 font-display font-bold text-xs uppercase tracking-widest text-brutal-ink/60 hover:text-brutal-ink mb-10 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>

            {resetDone ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 bg-[#0F8F3A] text-white brutal-border px-5 py-4 brutal-shadow">
                  <CheckCircle size={20} className="flex-shrink-0" />
                  <div>
                    <p className="font-display font-bold text-sm uppercase tracking-wide">Password Reset</p>
                    <p className="font-display font-bold text-xs text-white/80 mt-0.5 uppercase tracking-wider">
                      Your password has been updated. You can now sign in.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setView('login'); setResetDone(false); forgotForm.reset(); }}
                  className="w-full brutal-btn-primary py-4 text-base tracking-widest"
                >
                  Go to Sign In →
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-display font-bold text-4xl uppercase tracking-tighter text-brutal-ink mb-1">
                  Reset Password
                </h1>
                <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mb-10">
                  Enter your email and choose a new password
                </p>

                <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-5">
                  <div>
                    <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                      Email Address
                    </label>
                    <input
                      {...forgotForm.register('email')}
                      type="email"
                      placeholder="you@nexgen.in"
                      className="w-full brutal-border bg-brutal-cream px-4 py-3 font-body text-sm focus:outline-none focus:border-brutal-blue"
                    />
                    {forgotForm.formState.errors.email && (
                      <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">
                        {forgotForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                      New Password
                    </label>
                    <input
                      {...forgotForm.register('newPassword')}
                      type="password"
                      placeholder="••••••••"
                      className="w-full brutal-border bg-brutal-cream px-4 py-3 font-body text-sm focus:outline-none"
                    />
                    {forgotForm.formState.errors.newPassword && (
                      <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">
                        {forgotForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                      Confirm New Password
                    </label>
                    <input
                      {...forgotForm.register('confirm')}
                      type="password"
                      placeholder="••••••••"
                      className="w-full brutal-border bg-brutal-cream px-4 py-3 font-body text-sm focus:outline-none"
                    />
                    {forgotForm.formState.errors.confirm && (
                      <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">
                        {forgotForm.formState.errors.confirm.message}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 bg-brutal-red text-white brutal-border px-4 py-3 brutal-shadow">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                      <span className="font-display font-bold text-xs uppercase">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full brutal-btn-primary py-4 text-base tracking-widest disabled:opacity-60"
                  >
                    {loading ? 'Resetting…' : 'Reset Password →'}
                  </button>
                </form>
              </>
            )}

            <p className="text-center font-display font-bold text-xs uppercase tracking-widest text-[#4a4a4a] mt-10">
              NexGen Pharma Solutions — Internal Use Only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brutal-cream">
      {brandPanel}

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <span className="font-display font-bold text-2xl text-brutal-ink uppercase">NexGen</span>
            <span className="bg-brutal-ink text-brutal-yellow text-xs font-display font-bold px-2 py-1 uppercase">EMS</span>
          </div>

          <h1 className="font-display font-bold text-4xl uppercase tracking-tighter text-brutal-ink mb-1">
            Welcome Back
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mb-10">
            Sign in to your employee portal
          </p>

          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                Email Address
              </label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="you@nexgen.in"
                className="w-full brutal-border bg-brutal-cream px-4 py-3 font-body text-sm focus:outline-none focus:ring-0 focus:border-brutal-blue"
              />
              {loginForm.formState.errors.email && (
                <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-display font-bold text-xs uppercase tracking-widest text-brutal-ink">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); }}
                  className="font-display font-bold text-xs uppercase tracking-widest text-brutal-blue hover:underline underline-offset-4"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  {...loginForm.register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full brutal-border bg-brutal-cream px-4 py-3 pr-11 font-body text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a4a] hover:text-brutal-ink"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-brutal-red text-white brutal-border px-4 py-3 brutal-shadow">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span className="font-display font-bold text-xs uppercase">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full brutal-btn-primary py-4 text-base tracking-widest disabled:opacity-60"
            >
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>

          <p className="text-center font-display font-bold text-xs uppercase tracking-widest text-[#4a4a4a] mt-10">
            NexGen Pharma Solutions — Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
