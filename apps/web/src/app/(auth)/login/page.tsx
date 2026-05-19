'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router   = useRouter();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/login', data);
      setAuth(res.data.accessToken, res.data.refreshToken, res.data.user);
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

  return (
    <div className="min-h-screen flex bg-brutal-cream">
      {/* Left panel — brand */}
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

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@nexgen.in"
                className="w-full brutal-border bg-brutal-cream px-4 py-3 font-body text-sm focus:outline-none focus:ring-0 focus:border-brutal-blue"
              />
              {errors.email && <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-widest text-brutal-ink mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
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
              {errors.password && <p className="font-display font-bold text-xs uppercase text-brutal-red mt-1.5">{errors.password.message}</p>}
            </div>

            {/* Error */}
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
