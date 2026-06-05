import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  colorClass?: string;
  className?: string;
}

export function Badge({
  label,
  colorClass = 'bg-surface-container text-on-surface border border-outline-variant',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
