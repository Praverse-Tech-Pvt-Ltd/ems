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
      <div className="min-h-screen flex items-center justify-center w-full">
        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AppTopNav onMenuOpen={() => setNavOpen(!navOpen)} />
      
      {/* Mobile Sidebar Overlay */}
      {navOpen && (
         <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setNavOpen(false)}>
           <div onClick={(event) => event.stopPropagation()}>
             <AppSidebar className="flex" onNavigate={() => setNavOpen(false)} />
           </div>
         </div>
      )}
      
      {/* Desktop Sidebar */}
      <AppSidebar className="hidden md:flex" />

      {/* Main Content */}
      <main className="flex-1 md:ml-[280px] p-margin-mobile md:p-margin-desktop bg-surface-bright flex flex-col gap-lg w-full">
        {children}
      </main>
    </>
  );
}
