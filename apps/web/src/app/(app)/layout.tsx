'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { AppTopNav } from '@/components/layouts/AppTopNav';
import { NotificationsDrawer } from '@/components/layouts/NotificationsDrawer';
import { FaceEnrollModal } from '@/components/layouts/FaceEnrollModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, setAccessToken, clearAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);

  const [navOpen, setNavOpen]       = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [enrollDone, setEnrollDone] = useState(false);

  /**
   * Silent refresh on mount.
   * The access token lives in memory only, so it is gone after a page
   * refresh. We attempt a token refresh using the httpOnly cookie before
   * deciding whether the user is authenticated.
   */
  useEffect(() => {
    if (accessToken) {
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNavOpen(false); setNotifOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: me, isLoading: meLoading } = useQuery<{ faceEnrolled: boolean }>({
    queryKey: ['me-face'],
    queryFn: () => apiClient.get('/employees/me').then(r => r.data).catch(() => null),
    enabled: authReady && !!accessToken,
    staleTime: 60_000,
  });

  const showEnrollModal = false;

  // Don't render the app shell until we know whether the user is authenticated.
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brutal-cream">
        <div className="font-display font-bold text-sm uppercase tracking-widest text-brutal-ink/40 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brutal-cream">
      <AppSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AppTopNav
          onMenuOpen={() => setNavOpen(true)}
          onBell={() => setNotifOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 bg-brutal-cream">
          {children}
        </main>
      </div>
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      {showEnrollModal && (
        <FaceEnrollModal onDone={() => setEnrollDone(true)} />
      )}
    </div>
  );
}
