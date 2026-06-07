import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  colorClass?: string;
  className?: string;
  dot?: boolean;
}

export function Badge({
  label,
  colorClass = 'bg-canvas text-ink-secondary border border-border',
  className,
  dot,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-body tracking-wide',
        colorClass,
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />}
      {label}
    </span>
  );
}
