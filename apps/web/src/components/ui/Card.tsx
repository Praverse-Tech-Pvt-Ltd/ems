import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  elevation?: 'default' | 'featured' | 'flat';
  /** Top accent stripe color */
  accent?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'none';
}

const elevations = {
  default:  'bg-canvas-elevated border border-border shadow-xs hover:shadow-sm',
  featured: 'bg-canvas-elevated border border-border shadow-sm hover:shadow-md',
  flat:     'bg-canvas-sunken border border-transparent',
};

const accents = {
  violet:  'border-t-2 border-t-primary',
  cyan:    'border-t-2 border-t-cyan',
  emerald: 'border-t-2 border-t-emerald',
  amber:   'border-t-2 border-t-amber',
  rose:    'border-t-2 border-t-rose',
  none:    '',
};

export function Card({
  children,
  className,
  padding = true,
  elevation = 'default',
  accent = 'none',
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        elevations[elevation],
        accents[accent],
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
