'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { AppTopNav } from '@/components/layouts/AppTopNav';
import { NotificationsDrawer } from '@/components/layouts/NotificationsDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [navOpen, setNavOpen]     = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
    </div>
  );
}
