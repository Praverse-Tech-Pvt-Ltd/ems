'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { AppTopNav } from '@/components/layouts/AppTopNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, setAccessToken, clearAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (accessToken) {
      setAuthReady(true);
      return;
    }

    if (process.env['NEXT_PUBLIC_DEV_BYPASS'] === 'true') {
      setAccessToken('dev-token');
      setAuthReady(true);
      return;
    }

    axios
      .post<{ accessToken: string }>(
        `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setAuthReady(true);
      })
      .catch(() => {
        clearAuth();
        router.push('/login');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {navOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setNavOpen(false)}
        >
          <div className="absolute left-0 top-0 h-full" onClick={(e) => e.stopPropagation()}>
            <AppSidebar className="flex h-full" onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar — always visible */}
      <AppSidebar className="hidden md:flex" />

      {/* Right column: top nav + scrollable content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AppTopNav onMenuOpen={() => setNavOpen(!navOpen)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
