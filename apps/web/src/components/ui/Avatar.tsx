import { cn, initials } from '@/lib/utils';

type AvatarVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: AvatarVariant;
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

const variants: Record<AvatarVariant, string> = {
  primary:   'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary:  'bg-tertiary-container text-on-tertiary-container',
  inverse:   'bg-inverse-surface text-inverse-on-surface',
};

export function Avatar({ firstName, lastName, size = 'sm', variant = 'primary', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold flex-shrink-0 select-none',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
