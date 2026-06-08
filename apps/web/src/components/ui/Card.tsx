import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  elevation?: 'default' | 'featured' | 'flat' | 'glass' | 'interactive';
  accent?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'error' | 'none';
  hover?: boolean;
}

const elevations = {
  default:
    'bg-card border border-card-border/80 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_3px_rgba(19,27,46,0.06),0_4px_12px_rgba(19,27,46,0.04)]',
  featured:
    'bg-card border border-card-border ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_4px_16px_rgba(19,27,46,0.10),0_1px_4px_rgba(19,27,46,0.06)]',
  flat:
    'bg-surface-container-low border border-card-border/50',
  glass:
    'bg-white/80 backdrop-blur-xl border border-white/60 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_32px_rgba(19,27,46,0.10)]',
  interactive:
    'bg-card border border-card-border shadow-sm ' +
    'hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer',
};

const hoverStyles = {
  default:
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_20px_rgba(19,27,46,0.09)] hover:-translate-y-px',
  featured:
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_32px_rgba(19,27,46,0.13)] hover:-translate-y-[2px]',
  flat:
    'hover:bg-surface-container hover:border-outline-variant/40',
  glass:
    'hover:shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_12px_40px_rgba(19,27,46,0.12)] hover:-translate-y-px',
  interactive: '',
};

const accents = {
  primary:   'border-t-[2.5px] border-t-primary',
  secondary: 'border-t-[2.5px] border-t-secondary',
  tertiary:  'border-t-[2.5px] border-t-tertiary',
  success:   'border-t-[2.5px] border-t-success',
  error:     'border-t-[2.5px] border-t-error',
  none:      '',
};

export function Card({
  children,
  className,
  padding = true,
  elevation = 'default',
  accent = 'none',
  hover = false,
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        elevations[elevation],
        hover && hoverStyles[elevation],
        accents[accent],
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
