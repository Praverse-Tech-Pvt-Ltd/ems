'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Clock, DollarSign, FileText, Calendar,
  Send, Users, BarChart2, LogOut, Wallet, ShieldCheck, Settings, MessageSquare, X,
  Building2, CalendarCheck, PenLine, ClipboardList, Star, Bell, BrainCircuit, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ChatChannel } from '@/types';

interface Props { open: boolean; onClose: () => void; }

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

const SECTIONS = [
  {
    label: 'Work',
    roles: null,
    items: [
      { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  roles: null },
      { href: '/attendance', icon: Clock,            label: 'Attendance', roles: null },
      { href: '/leaves',     icon: Calendar,         label: 'Leaves',     roles: null },
      { href: '/expenses',   icon: DollarSign,       label: 'Expenses',   roles: null },
      { href: '/requests',   icon: Send,             label: 'Requests',   roles: null },
      { href: '/salary',     icon: Wallet,           label: 'Salary',     roles: null },
    ],
  },
  {
    label: 'Team',
    roles: null,
    items: [
      { href: '/employees', icon: Users,         label: 'Employees', roles: null },
      { href: '/chat',      icon: MessageSquare, label: 'Chat',      roles: null },
      { href: '/invoices',  icon: FileText,      label: 'Invoices',  roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as Role[] },
      { href: '/reports',   icon: BarChart2,     label: 'Reports',   roles: null },
    ],
  },
  {
    label: 'Intelligence',
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as Role[],
    items: [
      { href: '/companies',         icon: Building2,     label: 'Companies',       roles: null },
      { href: '/calendar',          icon: CalendarCheck, label: 'Calendar',        roles: null },
      { href: '/meeting-notes',     icon: PenLine,       label: 'Meeting Notes',   roles: null },
      { href: '/work-updates',      icon: ClipboardList, label: 'Work Updates',    roles: null },
      { href: '/management-review', icon: BarChart2,     label: 'Mgmt Review',     roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as Role[] },
      { href: '/follow-ups',        icon: Bell,          label: 'Follow-Ups',      roles: null },
      { href: '/chat-ai',           icon: BrainCircuit,  label: 'AI Chat',         roles: ['SUPER_ADMIN'] as Role[] },
      { href: '/owner',             icon: Star,          label: 'Owner AI',        roles: ['SUPER_ADMIN'] as Role[] },
    ],
  },
  {
    label: 'Admin',
    roles: ['SUPER_ADMIN', 'ADMIN'] as Role[],
    items: [
      { href: '/audit',      icon: ShieldCheck, label: 'Audit Log',         roles: ['SUPER_ADMIN', 'ADMIN'] as Role[] },
      { href: '/scheduling', icon: Calendar,    label: 'Client Scheduling', roles: ['SUPER_ADMIN', 'ADMIN'] as Role[] },
    ],
  },
];

export function AppSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();
  const initials  = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const userRole  = (user?.role ?? 'EMPLOYEE') as Role;
  const canSee    = (roles: Role[] | null) => !roles || roles.includes(userRole);

  const logout   = () => { clearAuth(); router.push('/login'); };
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const { data: chatChannels = [] } = useQuery<ChatChannel[]>({
    queryKey: ['chat-channels'],
    queryFn: () => apiClient.get('/chat/channels').then((r) => r.data).catch(() => []),
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const chatUnread = chatChannels.reduce((s, c) => s + c.unread, 0);

  const roleLabel: Record<Role, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        flex flex-col bg-surface-container-lowest border-r border-outline-variant shrink-0
        fixed lg:sticky top-0 left-0 lg:self-start
        z-50 lg:z-auto
        w-[260px] h-screen
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>

        {/* ── Logo / Brand ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant flex-shrink-0">
          {/* Logo mark */}
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center flex-shrink-0 shadow-sm">
            <img
              src="/brand/nexgen-logo-mark.png"
              alt="NexGen"
              className="w-6 h-6 object-contain brightness-0 invert"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-on-surface tracking-tight leading-none">NexGen</div>
            <div className="text-[10px] font-medium text-on-surface-variant mt-0.5 tracking-wide">Employee OS</div>
          </div>
          {/* Mobile close */}
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 min-h-0">
          {SECTIONS.filter(s => canSee(s.roles)).map((section) => {
            const visibleItems = section.items.filter(item => canSee(item.roles));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className="mb-4">
                {/* Section header */}
                <div className="px-2 py-1.5 mb-1">
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-[0.12em]">
                    {section.label}
                  </span>
                </div>

                {/* Items */}
                {visibleItems.map(({ href, icon: Icon, label }) => {
                  const active = isActive(href);
                  const isChatItem = href === '/chat';
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={`
                        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5
                        text-sm font-medium transition-all duration-150 cursor-pointer
                        ${active
                          ? 'bg-primary-fixed text-on-primary-fixed border-l-2 border-primary-container pl-[10px]'
                          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                        }
                      `}
                    >
                      <Icon
                        size={16}
                        className={`flex-shrink-0 transition-colors ${
                          active ? 'text-primary-container' : 'text-on-surface-variant group-hover:text-on-surface'
                        }`}
                      />
                      <span className="flex-1 truncate">{label}</span>

                      {/* Chat unread badge */}
                      {isChatItem && !active && chatUnread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-on-error rounded-full text-[9px] font-bold">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}

                      {/* Active chevron */}
                      {active && (
                        <ChevronRight
                          size={14}
                          className="text-primary-container flex-shrink-0 opacity-60"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── User Block ───────────────────────────────────────────────── */}
        <div className="px-3 pb-3 pt-2 border-t border-outline-variant flex-shrink-0 space-y-1.5">
          {/* Role chip */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-low">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Role</span>
            <span className="text-[10px] font-bold text-primary-container bg-primary-fixed px-2 py-0.5 rounded-full">
              {roleLabel[userRole]}
            </span>
          </div>

          {/* User identity */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container-low transition-colors">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary text-sm font-bold flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-on-surface truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[10px] text-on-surface-variant truncate mt-0.5 font-medium tracking-wide">
                {(user as { employeeId?: string })?.employeeId ?? user?.role}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-colors cursor-pointer"
            >
              <Settings size={13} />
              Settings
            </Link>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-error/10 text-error text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
