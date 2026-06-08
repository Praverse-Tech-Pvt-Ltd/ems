'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Bell, Search, ChevronRight } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':                   'Dashboard',
  '/employee-my-workday':         'Dashboard',
  '/attendance-punch-station':    'Attendance',
  '/leave-center':                'Leaves',
  '/expense-tracker':             'Expenses',
  '/requests':                    'Requests',
  '/salary-payslips':             'Salary',
  '/employee-directory':          'Employees',
  '/messaging-chat-hub':          'Chat',
  '/invoices':                    'Invoices',
  '/reports':                     'Reports',
  '/client-companies-overview':   'Companies',
  '/client-detail-gap-analysis':  'Gap Analysis',
  '/calendar-meeting-notes':      'Calendar',
  '/ai-work-intelligence':        'Work Updates',
  '/ai-talent-mapping':           'Talent Map',
  '/owner-command-center':        'Command Center',
  '/management-review-hub':       'Review Hub',
  '/audit-compliance-log':        'Audit Log',
  '/company-employee-assignment': 'Assign Companies',
};

/* ── Live IST clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      );
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
      style={{
        background: 'rgba(1,103,125,0.07)',
        border: '1px solid rgba(1,103,125,0.15)',
      }}
    >
      <span
        className="material-symbols-outlined flex-shrink-0"
        style={{ fontSize: '13px', color: '#01677d', fontVariationSettings: "'FILL' 1" }}
      >
        schedule
      </span>
      <span className="text-[12.5px] font-semibold text-on-surface num tracking-tight">
        {time || '--:--'}
      </span>
      <span
        className="text-[10px] font-bold px-1 py-0.5 rounded"
        style={{ background: 'rgba(1,103,125,0.12)', color: '#01677d' }}
      >
        IST
      </span>
    </div>
  );
}

/* ── Top nav ─────────────────────────────────────────────────────── */
export function AppTopNav({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname  = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? 'NexGen EMS';
  const [focused, setFocused] = useState(false);

  return (
    <header
      className="h-14 flex items-center px-4 gap-3 flex-shrink-0 z-30"
      style={{
        background: 'rgba(250,248,255,0.92)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid rgba(226,191,181,0.4)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 8px rgba(19,27,46,0.04)',
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuOpen}
        className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[20px] leading-none">menu</span>
      </button>

      {/* Mobile: logo + title */}
      <div className="md:hidden flex items-center gap-2 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
          <Image src="/brand/nexgen-logo-mark.png" alt="NexGen" width={28} height={28} className="w-full h-full object-cover" priority />
        </div>
        <span className="font-bold text-[17px] tracking-tight gradient-text-primary truncate">NexGen EMS</span>
      </div>

      {/* Desktop: logo + breadcrumb */}
      <nav className="hidden md:flex items-center gap-2 text-[13px]" aria-label="breadcrumb">
        <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 shadow-sm">
          <Image src="/brand/nexgen-logo-mark.png" alt="NexGen" width={24} height={24} className="w-full h-full object-cover" />
        </div>
        <span className="font-medium text-on-surface-variant/70 ml-0.5">NexGen</span>
        <ChevronRight size={13} className="text-on-surface-variant/40" />
        <span className="font-semibold text-on-surface">{pageLabel}</span>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Desktop: search bar */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200"
        style={{
          width: focused ? 320 : 260,
          background: focused ? 'rgba(1,103,125,0.04)' : 'rgba(242,243,255,0.9)',
          border: focused ? '1.5px solid rgba(1,103,125,0.4)' : '1.5px solid rgba(226,191,181,0.5)',
          boxShadow: focused ? '0 0 0 3px rgba(1,103,125,0.08)' : 'none',
          transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <Search size={13} className="text-on-surface-variant/60 flex-shrink-0" />
        <input
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search employees, requests…"
          className="bg-transparent border-none outline-none text-[12.5px] text-on-surface placeholder:text-on-surface-variant/50 flex-1 font-medium"
        />
      </div>

      {/* Bell button */}
      <button
        className="relative p-2 rounded-lg text-on-surface-variant transition-all duration-150 hover:bg-primary-container/40 hover:text-primary"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {/* Notification dot with pulse */}
        <span className="absolute top-1.5 right-1.5 w-[8px] h-[8px] rounded-full bg-primary border-2 border-card animate-pulse-dot" />
      </button>

      {/* Live clock */}
      <LiveClock />

      {/* Mobile: search icon */}
      <button className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
        <Search size={18} />
      </button>
    </header>
  );
}
