'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Search, Menu, X, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Employee } from '@/types';
import Link from 'next/link';

function useClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

interface Props {
  onMenuOpen: () => void;
  onBell: () => void;
}

export function AppTopNav({ onMenuOpen, onBell }: Props) {
  const clock = useClock();
  const time = clock
    ? clock.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '--:--';

  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery]       = useState('');
  const [focused, setFocused]   = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(rawQuery.trim()), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawQuery]);

  // Click outside closes dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showDropdown = focused && query.length >= 2;

  const { data: searchResults = [], isFetching } = useQuery<Employee[]>({
    queryKey: ['employees-search', query],
    queryFn: () =>
      apiClient
        .get('/employees', { params: { search: query } })
        .then(r => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    enabled: showDropdown,
    staleTime: 20_000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiClient.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant flex items-center gap-3 px-4 sm:px-6 h-14 flex-shrink-0 relative z-30">

      {/* Mobile hamburger */}
      <button
        onClick={onMenuOpen}
        aria-label="Open menu"
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer flex-shrink-0"
      >
        <Menu size={20} />
      </button>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <div className="flex items-center gap-2.5 bg-surface-container-low rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-container/40 transition-all">
          <Search size={15} className="text-on-surface-variant flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search people, requests, policies…"
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none min-w-0"
          />
          {rawQuery ? (
            <button
              onClick={() => { setRawQuery(''); setQuery(''); setFocused(false); }}
              className="flex-shrink-0 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-on-surface-variant/50 bg-surface-container border border-outline-variant rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Search dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden animate-fade-up">
            {isFetching && (
              <div className="px-4 py-6 text-center text-sm text-on-surface-variant flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                Searching…
              </div>
            )}
            {!isFetching && searchResults.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
            {!isFetching && searchResults.slice(0, 8).map((emp, idx) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                onClick={() => { setRawQuery(''); setQuery(''); setFocused(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors cursor-pointer ${
                  idx !== Math.min(searchResults.length, 8) - 1
                    ? 'border-b border-outline-variant/40'
                    : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-on-surface truncate">
                    {emp.firstName} {emp.lastName}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate">
                    {emp.employeeCode}
                    {emp.designation ? ` · ${emp.designation}` : ''}
                    {emp.department ? ` · ${emp.department.name}` : ''}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  emp.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-error-container text-on-error-container border border-error/20'
                }`}>
                  {emp.status}
                </span>
              </Link>
            ))}
            {!isFetching && searchResults.length > 8 && (
              <div className="px-4 py-2.5 border-t border-outline-variant/40 text-xs text-on-surface-variant text-center">
                +{searchResults.length - 8} more results
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Right actions ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* IST Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant">
          <Clock size={13} />
          <span className="text-xs font-semibold num">{time}</span>
          <span className="text-[10px] text-on-surface-variant/60 font-medium">IST</span>
        </div>

        {/* Notifications bell */}
        <button
          onClick={onBell}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-surface-container-lowest" />
          )}
        </button>
      </div>
    </header>
  );
}
