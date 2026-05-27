'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Search, Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Employee } from '@/types';
import Link from 'next/link';

const TICKER_ITEMS = [
  'SYS STATUS · NOMINAL',
  'PAYROLL CUTOFF · 25 MAY',
  'NEW POLICY 14-B · TRAVEL CAPS REVISED',
  'BIOMETRIC SVC · ONLINE',
  'COMPLIANCE WINDOW CLOSES IN 06D 12H',
  'OFFICE · PRINCE CUBE, GOTRI, VADODARA',
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
  const time = clock ? clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

  const [rawQuery, setRawQuery]     = useState('');
  const [query, setQuery]           = useState('');
  const [focused, setFocused]       = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef                   = useRef<HTMLDivElement>(null);

  // Debounce raw input → committed query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(rawQuery.trim());
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDropdown = focused && query.length >= 2;

  const { data: searchResults = [], isFetching } = useQuery<Employee[]>({
    queryKey: ['employees-search', query],
    queryFn: () =>
      apiClient.get('/employees', { params: { search: query } })
        .then(r => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    enabled: showDropdown,
    staleTime: 20_000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: () => apiClient.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <Ticker />
      <header className="bg-brutal-cream brutal-border-b flex items-stretch flex-shrink-0 relative z-30">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuOpen}
          aria-label="Open menu"
          className="lg:hidden px-4 brutal-border-r hover:bg-brutal-yellow flex items-center transition-colors"
        >
          <Menu size={18} />
        </button>

        {/* Search area */}
        <div ref={searchRef} className="relative flex-1 flex items-stretch min-w-0">
          <div className="hidden sm:flex items-center gap-2 px-4 brutal-border-r pointer-events-none">
            <Search size={14} className="text-brutal-ink/60" />
            <span className="font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/60">FIND</span>
          </div>
          <div className="sm:hidden grid place-items-center px-4 brutal-border-r pointer-events-none">
            <Search size={14} className="text-brutal-ink/60" />
          </div>
          <input
            type="search"
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="People · Requests · Vault entries · Policies"
            className="flex-1 min-w-0 w-0 bg-transparent px-3 sm:px-4 py-3 focus:outline-none text-[13px] sm:text-[14px] placeholder:text-brutal-ink/40 font-medium"
          />
          {rawQuery && (
            <button
              onClick={() => { setRawQuery(''); setQuery(''); setFocused(false); }}
              className="px-3 flex items-center text-brutal-ink/50 hover:text-brutal-ink"
            >
              <X size={14} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-0 bg-brutal-cream brutal-border brutal-shadow-lg z-50 max-h-[320px] overflow-y-auto">
              {isFetching && (
                <div className="px-5 py-4 font-display font-bold text-[10px] tracking-[0.22em] text-brutal-ink/50 text-center">
                  SEARCHING…
                </div>
              )}
              {!isFetching && searchResults.length === 0 && (
                <div className="px-5 py-4 font-display font-bold text-[11px] tracking-[0.18em] text-brutal-ink/50 text-center">
                  NO RESULTS FOR &ldquo;{query}&rdquo;
                </div>
              )}
              {!isFetching && searchResults.slice(0, 8).map((emp, idx) => (
                <Link
                  key={emp.id}
                  href={`/employees/${emp.id}`}
                  onClick={() => { setRawQuery(''); setQuery(''); setFocused(false); }}
                  className={`flex items-center gap-4 px-5 py-3 hover:bg-brutal-yellow transition-colors ${
                    idx !== Math.min(searchResults.length, 8) - 1 ? 'brutal-border-b' : ''
                  }`}
                >
                  <div className="w-9 h-9 flex-shrink-0 grid place-items-center bg-brutal-ink text-brutal-yellow font-display font-bold text-[13px] border-2 border-brutal-ink">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[13px] tracking-tight truncate">
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="font-display font-bold text-[10px] tracking-[0.14em] text-brutal-ink/60 truncate">
                      {emp.employeeCode}{emp.designation ? ` · ${emp.designation}` : ''}{emp.department ? ` · ${emp.department.name}` : ''}
                    </div>
                  </div>
                  <span className={`font-display font-bold text-[9px] tracking-[0.14em] px-1.5 py-0.5 border-2 border-brutal-ink flex-shrink-0 ${
                    emp.status === 'ACTIVE' ? 'bg-[#0F8F3A] text-white' : 'bg-brutal-red text-white'
                  }`}>
                    {emp.status}
                  </span>
                </Link>
              ))}
              {!isFetching && searchResults.length > 8 && (
                <div className="px-5 py-2.5 brutal-border-t font-display font-bold text-[10px] tracking-[0.18em] text-brutal-ink/50 text-center">
                  + {searchResults.length - 8} MORE
                </div>
              )}
            </div>
          )}
        </div>

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
