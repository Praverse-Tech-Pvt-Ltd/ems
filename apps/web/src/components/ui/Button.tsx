import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  // Primary — pill-shaped, burnt orange, high contrast
  primary:
    'bg-primary-container text-on-primary shadow-sm ' +
    'hover:bg-primary hover:shadow-md ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:pointer-events-none',

  // Secondary — ghost with border, inlay fill
  secondary:
    'bg-surface-container-low text-on-surface border border-outline-variant ' +
    'hover:bg-surface-container hover:border-outline ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:pointer-events-none',

  // Ghost — no background
  ghost:
    'text-on-surface-variant hover:bg-surface-container-low ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:pointer-events-none',

  // Danger — error red
  danger:
    'bg-error text-on-error shadow-sm ' +
    'hover:opacity-90 hover:shadow-md ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:pointer-events-none',

  // Teal — secondary brand
  teal:
    'bg-secondary text-on-secondary shadow-sm ' +
    'hover:opacity-90 hover:shadow-md ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:pointer-events-none',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-xs font-semibold',
  md: 'px-5 py-2 text-sm font-semibold',
  lg: 'px-6 py-2.5 text-base font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition-all duration-150 cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
