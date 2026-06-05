import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

export function Avatar({ firstName, lastName, size = 'sm', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold flex-shrink-0 select-none',
        'bg-primary-container text-on-primary',
        sizes[size],
        className,
      )}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
