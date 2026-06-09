'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Avatar } from '@/components/ui/Avatar';
import { LogOut } from 'lucide-react';

type NavItem = { href: string; label: string; icon: string; roles?: string[]; badge?: boolean };
type NavGroup = { label: string; roles?: string[]; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { href: '/dashboard',                 label: 'Dashboard',  icon: 'work_history'    },
      { href: '/attendance-punch-station', label: 'Attendance', icon: 'fingerprint'     },
      { href: '/leave-center',             label: 'Leaves',     icon: 'event_available' },
      { href: '/expense-tracker',          label: 'Expenses',   icon: 'receipt_long'    },
      { href: '/requests',                 label: 'Requests',   icon: 'send'            },
      { href: '/salary-payslips',          label: 'Salary',     icon: 'payments'        },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/employee-directory', label: 'Employees', icon: 'badge'       },
      { href: '/messaging-chat-hub', label: 'Chat',      icon: 'forum', badge: true },
      { href: '/invoices',           label: 'Invoices',  icon: 'description', roles: ['SUPER_ADMIN'] },
      { href: '/reports',            label: 'Reports',   icon: 'bar_chart'   },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/client-companies-overview',  label: 'Companies',    icon: 'domain'         },
      { href: '/client-detail-gap-analysis', label: 'Gap Analysis', icon: 'rule_settings' },
      { href: '/calendar-meeting-notes',     label: 'Calendar',     icon: 'calendar_month' },
      { href: '/ai-work-intelligence',       label: 'Work Updates', icon: 'neurology'      },
      { href: '/ai-talent-mapping',          label: 'Talent Map',   icon: 'psychology',     roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
      { href: '/owner-command-center',       label: 'Command',      icon: 'work',           roles: ['ADMIN', 'SUPER_ADMIN'] },
      { href: '/management-review-hub',      label: 'Review Hub',   icon: 'rate_review',    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    items: [
      { href: '/admin-approvals',             label: 'Approvals',        icon: 'approval',       roles: ['SUPER_ADMIN'] },
      { href: '/audit-compliance-log',        label: 'Audit Log',        icon: 'verified_user',  roles: ['ADMIN', 'SUPER_ADMIN'] },
      { href: '/company-employee-assignment', label: 'Assign Companies', icon: 'assignment_ind', roles: ['SUPER_ADMIN'] },
    ],
  },
];

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  MANAGER:     'Manager',
  EMPLOYEE:    'Employee',
};

export function AppSidebar({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user      = useAuthStore((s) => s.user);
  const role      = user?.role ?? 'EMPLOYEE';

  const canSee = (roles?: string[]) => !roles || roles.includes(role);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const visibleGroups = navGroups
    .filter(g => canSee(g.roles))
    .map(g => ({ ...g, items: g.items.filter(i => canSee(i.roles)) }))
    .filter(g => g.items.length > 0);

  return (
    <nav
      className={`flex flex-col h-full w-[260px] max-w-[85vw] flex-shrink-0 overflow-y-auto ${className}`}
      style={{ background: 'linear-gradient(180deg, #f7f5ff 0%, #f2f3ff 100%)' }}
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-[15px] flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(226,191,181,0.5)' }}
      >
        {/* Logomark */}
        <div className="w-9 h-9 rounded-[10px] flex-shrink-0 shadow-sm overflow-hidden">
          <Image
            src="/brand/nexgen-logo-mark.png"
            alt="NexGen"
            width={36}
            height={36}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div>
          <div className="font-bold text-[14.5px] text-on-surface leading-tight tracking-[-0.01em]">
            NexGen EMS
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(170,48,0,0.09)', color: '#aa3000' }}
            >
              Enterprise
            </span>
            <span className="text-[10px] text-on-surface-variant/60 font-medium">v3.1</span>
          </div>
        </div>
      </div>

      {/* ── Nav groups ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
            {/* Section label */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
              <span className="text-[9.5px] font-bold text-on-surface-variant/50 tracking-[0.1em] uppercase">
                {group.label}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(226,191,181,0.4)' }} />
            </div>

            {/* Items */}
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`
                    group relative flex items-center gap-2.5 px-3 py-[9px] rounded-xl mx-0 my-0.5
                    transition-all duration-200 ease-out
                    ${active
                      ? 'text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                    }
                  `}
                  style={
                    active
                      ? {
                          background: 'linear-gradient(90deg, rgba(170,48,0,0.10) 0%, rgba(170,48,0,0.04) 70%, transparent 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(170,48,0,0.08)',
                          border: '1px solid rgba(170,48,0,0.12)',
                        }
                      : {
                          border: '1px solid transparent',
                        }
                  }
                >
                  {/* Left accent bar (active only) */}
                  {active && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                      style={{ background: 'linear-gradient(180deg, #aa3000 0%, #d04411 100%)' }}
                    />
                  )}

                  {/* Icon */}
                  <span
                    className={`
                      material-symbols-outlined text-[18px] leading-none flex-shrink-0
                      transition-all duration-200
                      ${active ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}
                    `}
                    style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 600" } : { fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                  >
                    {item.icon}
                  </span>

                  {/* Label */}
                  <span className={`text-[13px] flex-1 truncate transition-all duration-200 ${active ? 'font-semibold' : 'font-medium group-hover:font-[500]'}`}>
                    {item.label}
                  </span>

                  {/* Badge dot */}
                  {item.badge && (
                    <span
                      className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${active ? 'bg-primary/40' : 'bg-primary animate-pulse-dot'}`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── User block ───────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 py-3 mx-0"
        style={{ borderTop: '1px solid rgba(226,191,181,0.5)' }}
      >
        <div
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(226,191,181,0.4)' }}
        >
          <button
            onClick={() => { router.push('/employee-profile/me'); onNavigate?.(); }}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            title="View my profile"
          >
          <Avatar
            firstName={user?.firstName ?? 'U'}
            lastName={user?.lastName ?? ''}
            size="sm"
            variant="primary"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-on-surface truncate leading-tight">
              {user?.firstName ?? 'User'} {user?.lastName ?? ''}
            </div>
            <div className="text-[10.5px] text-on-surface-variant/70 mt-0.5 font-medium">
              {roleLabel[role] ?? role}
            </div>
          </div>
          </button>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant/60 hover:bg-error/10 hover:text-error transition-all duration-150"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </nav>
  );
}
