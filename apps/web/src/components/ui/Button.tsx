import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary:
    'bg-primary text-white shadow-sm ' +
    'hover:bg-primary-dim hover:shadow-md ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  secondary:
    'bg-canvas-elevated text-ink border border-border ' +
    'hover:bg-canvas-sunken hover:border-border-strong ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  ghost:
    'text-ink-secondary hover:bg-canvas-sunken hover:text-ink ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  danger:
    'bg-rose text-white shadow-sm ' +
    'hover:opacity-90 hover:shadow-md ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',

  teal:
    'bg-cyan text-white shadow-sm ' +
    'hover:opacity-90 hover:shadow-md ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:pointer-events-none',
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-xs font-semibold',
  md: 'px-4 py-2 text-sm font-semibold',
  lg: 'px-5 py-2.5 text-sm font-semibold',
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
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 cursor-pointer font-body',
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
