'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { AppTopNav } from '@/components/layouts/AppTopNav';
import { NotificationsDrawer } from '@/components/layouts/NotificationsDrawer';
import { FaceEnrollModal } from '@/components/layouts/FaceEnrollModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [navOpen, setNavOpen]       = useState(false);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [enrollDone, setEnrollDone] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [isAuthenticated, router]);

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
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });

  // Show modal when profile loaded and face not enrolled, unless user just completed it
  const showEnrollModal = !meLoading && me !== null && me !== undefined && !me.faceEnrolled && !enrollDone;

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
