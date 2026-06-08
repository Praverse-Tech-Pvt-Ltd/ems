import { cn } from '@/lib/utils';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
  /** Legacy prop — use variant instead */
  colorClass?: string;
  /** Legacy prop */
  label?: string;
}

const variants: Record<BadgeVariant, string> = {
  primary:   'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  success:   'bg-[#d1fae5] text-[#065f46]',
  warning:   'bg-[#fef3c7] text-[#92400e]',
  error:     'bg-error-container text-on-error-container',
  neutral:   'bg-surface-container text-on-surface',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
  dot,
  colorClass,
  label,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide',
        colorClass ?? variants[variant],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />}
      {children ?? label}
    </span>
  );
}
