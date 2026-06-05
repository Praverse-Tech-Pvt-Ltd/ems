import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  /** 'default' = 1px border + sm shadow | 'featured' = primary 2px border + glow */
  elevation?: 'default' | 'featured' | 'flat';
}

const elevations = {
  default:  'bg-surface-container-lowest border border-outline-variant shadow-sm',
  featured: 'bg-surface-container-lowest border-2 border-primary-container shadow-md',
  flat:     'bg-surface-container-low',
};

export function Card({ children, className, padding = true, elevation = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl transition-shadow',
        elevations[elevation],
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
