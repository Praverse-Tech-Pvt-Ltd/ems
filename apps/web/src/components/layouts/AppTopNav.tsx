'use client';

import { useState, useEffect } from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const TICKER_ITEMS = [
  'SYS STATUS · NOMINAL',
  'PAYROLL CUTOFF · 25 MAY',
  'NEW POLICY 14-B · TRAVEL CAPS REVISED',
  'BIOMETRIC SVC · ONLINE',
  'COMPLIANCE WINDOW CLOSES IN 06D 12H',
  'OFFICE NETWORK · NXGN-LAB-B',
];

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Ticker() {
  const row = (
    <div className="flex items-center gap-8 shrink-0 pr-8">
      {TICKER_ITEMS.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 bg-brutal-ink flex-shrink-0" />
          <span className="font-display font-bold text-[10px] tracking-[0.2em] whitespace-nowrap text-brutal-ink">
            {item}
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden bg-brutal-yellow brutal-border-b h-8 flex items-center">
      <div className="flex animate-marquee whitespace-nowrap">
        {row}{row}{row}
      </div>
    </div>
  );
}

interface Props {
  onMenuOpen: () => void;
  onBell: () => void;
}

export function AppTopNav({ onMenuOpen, onBell }: Props) {
  const clock = useClock();
  const time = clock ? clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: () => apiClient.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <Ticker />
      <header className="bg-brutal-cream brutal-border-b flex items-stretch flex-shrink-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuOpen}
          aria-label="Open menu"
          className="lg:hidden px-4 brutal-border-r hover:bg-brutal-yellow flex items-center transition-colors"
        >
          <Menu size={18} />
        </button>

        {/* Search area */}
        <div className="hidden sm:flex items-center gap-2 px-4 brutal-border-r">
          <Search size={14} className="text-brutal-ink/60" />
          <span className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/60">FIND</span>
        </div>
        <div className="sm:hidden grid place-items-center px-4 brutal-border-r">
          <Search size={14} className="text-brutal-ink/60" />
        </div>
        <input
          type="search"
          placeholder="People · Requests · Vault entries · Policies"
          className="flex-1 min-w-0 w-0 bg-transparent px-3 sm:px-4 py-3 focus:outline-none text-[13px] sm:text-[14px] placeholder:text-brutal-ink/40 font-medium"
        />

        {/* ⌘K hint — desktop */}
        <div className="hidden md:flex items-center gap-1 px-4 brutal-border-l bg-brutal-surface">
          <kbd className="font-display font-bold text-[10px] px-1.5 py-0.5 bg-brutal-ink text-brutal-cream">⌘</kbd>
          <kbd className="font-display font-bold text-[10px] px-1.5 py-0.5 bg-brutal-ink text-brutal-cream">K</kbd>
        </div>

        {/* Bell */}
        <button
          onClick={onBell}
          className="relative px-3 sm:px-4 brutal-border-l hover:bg-brutal-yellow transition-colors flex items-center gap-2"
        >
          <Bell size={15} className="text-brutal-ink" />
          <span className="hidden sm:inline font-display font-bold text-[10px] tracking-[0.18em]">
            {unreadCount} ALERTS
          </span>
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-brutal-red border-2 border-brutal-cream" />
          )}
        </button>

        {/* Clock */}
        <div className="hidden sm:flex px-5 brutal-border-l bg-brutal-ink text-brutal-cream items-center gap-2 flex-shrink-0">
          <span className="font-display font-bold text-[13px] num tracking-tight">{time}</span>
          <span className="hidden md:inline font-display font-bold text-[9px] tracking-[0.2em] text-brutal-cream/60">IST</span>
        </div>
      </header>
    </>
  );
}
