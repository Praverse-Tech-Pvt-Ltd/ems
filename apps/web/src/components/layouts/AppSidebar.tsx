'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Clock, DollarSign, FileText, Calendar,
  Send, Users, BarChart2, LogOut, Wallet, ShieldCheck, Settings, MessageSquare, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

interface Props { open: boolean; onClose: () => void; }

const SECTIONS = [
  {
    label: 'WORK',
    items: [
      { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  num: '01' },
      { href: '/attendance', icon: Clock,            label: 'Attendance', num: '02' },
      { href: '/leaves',     icon: Calendar,         label: 'Leaves',     num: '03' },
      { href: '/expenses',   icon: DollarSign,       label: 'Expenses',   num: '04' },
      { href: '/requests',   icon: Send,             label: 'Requests',   num: '05' },
      { href: '/salary',     icon: Wallet,           label: 'Salary',     num: '06' },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { href: '/employees', icon: Users,    label: 'Employees', num: '07' },
      { href: '/invoices',  icon: FileText, label: 'Invoices',  num: '08' },
      { href: '/reports',   icon: BarChart2,label: 'Reports',   num: '09' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { href: '/audit',   icon: ShieldCheck,   label: 'Audit Log', num: '10' },
    ],
  },
];

export function AppSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const logout   = () => { clearAuth(); router.push('/login'); };
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
        />
      )}

      <aside className={`
        flex flex-col brutal-border-r bg-brutal-cream shrink-0
        fixed lg:sticky top-0 left-0 lg:self-start
        z-50 lg:z-auto
        w-[260px] lg:w-[220px] h-screen
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo block */}
        <div className="relative px-4 py-4 bg-brutal-yellow brutal-border-b overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 grid place-items-center bg-brutal-ink brutal-border flex-shrink-0">
              <img src="/brand/nexgen-logo-mark.png" alt="NexGen" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[17px] leading-none tracking-tight text-brutal-ink">NEXGEN</div>
              <div className="font-display font-bold text-[8px] tracking-[0.12em] mt-1 text-brutal-ink/70">EMPLOYEE OS · v3.1</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="lg:hidden w-8 h-8 grid place-items-center bg-brutal-ink text-brutal-yellow border-2 border-brutal-ink hover:bg-brutal-red hover:text-white transition"
            >
              <X size={14} />
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-brutal-ink rotate-45 pointer-events-none" />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto min-h-0">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-3 pt-3 pb-1 font-display font-bold text-[10px] tracking-[0.24em] text-brutal-ink/50">
                — {section.label} —
              </div>
              {section.items.map(({ href, icon: Icon, label, num }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`relative flex items-center gap-3 mx-2 px-2 py-2.5 mb-0.5 border-2 border-brutal-ink font-display font-bold text-[13px] transition-all ${
                      active
                        ? 'bg-brutal-blue text-white brutal-shadow-sm -translate-x-0.5 -translate-y-0.5'
                        : 'border-transparent bg-transparent hover:bg-brutal-surface'
                    }`}
                  >
                    <span className={`font-display font-bold text-[10px] w-5 flex-shrink-0 ${active ? 'text-white/70' : 'text-brutal-ink/40'}`}>
                      {num}
                    </span>
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {active && <span className="w-2.5 h-2.5 bg-brutal-yellow border-2 border-brutal-ink flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Role badge */}
        <div className="mx-3 mb-2 flex items-stretch border-2 border-brutal-ink">
          <div className="px-2 py-1.5 bg-brutal-ink text-brutal-yellow font-display font-bold text-[10px] tracking-[0.18em] flex-shrink-0">ROLE</div>
          <div className="flex-1 px-2 py-1.5 bg-brutal-yellow font-display font-bold text-[10px] tracking-[0.18em] text-center text-brutal-ink">
            {user?.role?.replace('_', ' ') ?? 'EMPLOYEE'}
          </div>
        </div>

        {/* User block */}
        <div className="mx-3 mb-3 brutal-border brutal-shadow-sm bg-brutal-surface">
          <div className="flex items-center gap-3 p-3 brutal-border-b">
            <div className="w-9 h-9 grid place-items-center bg-brutal-ink text-brutal-yellow font-display font-bold text-[12px] flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[12px] leading-tight truncate text-brutal-ink">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="font-display font-bold text-[9px] tracking-[0.12em] uppercase text-brutal-ink/60 mt-0.5 truncate">
                {(user as { employeeId?: string })?.employeeId ?? user?.role}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <Link href="/profile" onClick={onClose} className="py-2 text-center font-display font-bold text-[10px] tracking-[0.16em] uppercase brutal-border-r hover:bg-brutal-yellow transition-colors flex items-center justify-center gap-1">
              <Settings size={10} /> SETUP
            </Link>
            <button onClick={logout} className="py-2 font-display font-bold text-[10px] tracking-[0.16em] uppercase hover:bg-brutal-red hover:text-white transition-colors flex items-center justify-center gap-1">
              <LogOut size={10} /> EXIT
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
