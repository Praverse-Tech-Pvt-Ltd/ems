'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { AppTopNav } from '@/components/layouts/AppTopNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [isAuthenticated, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-brutal-cream">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppTopNav />
        <main className="flex-1 overflow-y-auto p-8 bg-brutal-cream">
          {children}
        </main>
      </div>
    </div>
  );
}
