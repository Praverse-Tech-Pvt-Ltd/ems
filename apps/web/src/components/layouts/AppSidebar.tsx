'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const navGroups = [
  {
    label: 'Command',
    items: [
      { href: '/owner-command-center', label: 'Command Center', icon: 'work' },
      { href: '/management-review-hub', label: 'Review Hub', icon: 'rate_review' },
      { href: '/audit-compliance-log', label: 'Audit Log', icon: 'verified_user' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/employee-my-workday', label: 'My Workday', icon: 'work_history' },
      { href: '/ai-work-intelligence', label: 'AI Work Intel', icon: 'neurology' },
      { href: '/employee-directory', label: 'Directory', icon: 'badge' },
      { href: '/ai-talent-mapping', label: 'Talent Map', icon: 'psychology' },
      { href: '/attendance-punch-station', label: 'Attendance', icon: 'fingerprint' },
      { href: '/leave-center', label: 'Leave Center', icon: 'event_available' },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/client-companies-overview', label: 'Clients', icon: 'domain' },
      { href: '/client-detail-gap-analysis', label: 'Gap Analysis', icon: 'rule_settings' },
      { href: '/expense-tracker', label: 'Expenses', icon: 'receipt_long' },
      { href: '/salary-payslips', label: 'Payslips', icon: 'payments' },
      { href: '/calendar-meeting-notes', label: 'Meetings', icon: 'calendar_month' },
      { href: '/messaging-chat-hub', label: 'Chat Hub', icon: 'forum' },
    ],
  },
];

export function AppSidebar({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <nav className={`flex flex-col py-md gap-sm bg-surface-container-low dark:bg-inverse-surface fixed left-0 top-0 h-full w-[280px] z-50 shadow-md ${className}`}>
      <div className="px-md">
        <img alt="NexGen EMS" className="h-10 w-auto mb-sm" src="/brand/nexgen-logo-full.png" />
        <h1 className="font-headline-lg text-headline-lg font-black text-primary">NexGen EMS</h1>
        <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs">Role Based Command Center</p>
      </div>

      <div className="flex-1 flex flex-col gap-sm overflow-y-auto px-xs">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-xs">
            <div className="font-label-caps text-[10px] text-on-surface-variant/70 px-4 pt-xs tracking-widest">{group.label}</div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-sm px-4 py-3 mx-1 transition-all rounded-full hover:translate-x-1 duration-300 ${
                    active
                      ? 'bg-secondary-container text-on-secondary-container font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high dark:hover:bg-secondary/20'
                  }`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="font-label-caps text-label-caps truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-md mt-auto">
        <Link href="/owner-command-center" onClick={onNavigate} className="w-full bg-primary text-on-primary font-label-caps text-label-caps py-sm rounded-full flex items-center justify-center gap-xs hover:bg-primary-container transition-colors shadow-sm mb-sm">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          Ask AI Intelligence
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-sm text-on-surface-variant hover:text-primary px-4 py-2 mx-2 hover:bg-surface-container-high transition-all rounded-full w-full text-left">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-caps text-label-caps">Logout</span>
        </button>
      </div>
    </nav>
  );
}
