'use client';

import { useState, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const TICKER_ITEMS = [
  'SYS STATUS · NOMINAL',
  'PAYROLL CUTOFF · 25 MAY',
  'NEW POLICY 14-B · TRAVEL CAPS REVISED',
  'BIOMETRIC SVC · ONLINE',
  'COMPLIANCE WINDOW CLOSES IN 06D 12H',
  'OFFICE NETWORK · NXGN-LAB-B',
];

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
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

export function AppTopNav() {
  const user  = useAuthStore((s) => s.user);
  const time  = useClock();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <>
      <Ticker />
      <header className="h-14 bg-brutal-cream brutal-border-b flex items-stretch flex-shrink-0">
        {/* Search */}
        <div className="flex items-center gap-2 px-4 brutal-border-r">
          <Search size={14} className="text-brutal-ink/60" />
          <span className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/60">FIND</span>
        </div>
        <input
          type="search"
          placeholder="People · Requests · Policies"
          className="flex-1 min-w-0 bg-transparent px-4 focus:outline-none font-body text-[13px] placeholder:text-brutal-ink/40"
        />

        {/* Bell */}
        <button className="relative px-4 brutal-border-l hover:bg-brutal-yellow transition-colors flex items-center gap-2">
          <Bell size={15} className="text-brutal-ink" />
          <span className="font-display font-bold text-[10px] tracking-[0.18em]">ALERTS</span>
          <span className="absolute top-3 right-3 w-2 h-2 bg-brutal-red border-2 border-brutal-cream" />
        </button>

        {/* Clock */}
        <div className="px-5 brutal-border-l bg-brutal-ink text-brutal-cream flex items-center gap-2 flex-shrink-0">
          <span className="font-display font-bold text-[14px] tracking-tight">{time}</span>
          <span className="font-display font-bold text-[9px] tracking-[0.2em] text-brutal-cream/60">IST</span>
        </div>

        {/* Avatar */}
        <div className="w-14 brutal-border-l bg-brutal-surface flex items-center justify-center flex-shrink-0">
          <div className="w-9 h-9 bg-brutal-ink text-brutal-yellow flex items-center justify-center font-display font-bold text-xs">
            {initials}
          </div>
        </div>
      </header>
    </>
  );
}
