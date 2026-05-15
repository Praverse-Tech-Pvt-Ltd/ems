import { cn } from '@/lib/utils';

interface BadgeProps {
  label: string;
  colorClass?: string;
  className?: string;
}

export function Badge({ label, colorClass = 'bg-slate-100 text-slate-600', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colorClass, className)}>
      {label}
    </span>
  );
}
