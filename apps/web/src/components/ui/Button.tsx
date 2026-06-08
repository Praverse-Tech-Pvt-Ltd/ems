import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary:
    'text-white shadow-md ' +
    'hover:shadow-lg hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:shadow-sm ' +
    'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none disabled:translate-y-0',

  secondary:
    'bg-surface-container-low text-on-surface border border-outline-variant/70 ' +
    'hover:bg-surface-container hover:border-outline hover:-translate-y-px hover:shadow-sm ' +
    'active:translate-y-0 active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  ghost:
    'text-on-surface-variant hover:bg-surface-container hover:text-on-surface ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  danger:
    'bg-error text-on-error shadow-sm ' +
    'hover:shadow-md hover:opacity-90 hover:-translate-y-px ' +
    'active:translate-y-0 active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  teal:
    'text-white shadow-sm ' +
    'hover:shadow-md hover:opacity-90 hover:-translate-y-px ' +
    'active:translate-y-0 active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-xs font-semibold',
  md: 'px-4 py-2 text-[13px] font-semibold',
  lg: 'px-5 py-2.5 text-sm font-semibold',
};

/* Inline gradient styles (can't use arbitrary Tailwind for complex gradients) */
const gradientStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, #aa3000 0%, #c84010 60%, #d04a18 100%)', boxShadow: '0 2px 10px rgba(170,48,0,0.30), 0 1px 0 rgba(255,255,255,0.12) inset' },
  teal:    { background: 'linear-gradient(135deg, #01677d 0%, #0289a8 100%)', boxShadow: '0 2px 10px rgba(1,103,125,0.28), 0 1px 0 rgba(255,255,255,0.12) inset' },
  secondary: {},
  ghost: {},
  danger: {},
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      style={{ ...gradientStyles[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
