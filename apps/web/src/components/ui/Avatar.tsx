import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' };

export function Avatar({ firstName, lastName, size = 'sm', className }: AvatarProps) {
  return (
    <div className={cn('rounded-lg bg-gradient-to-br from-brand-light to-accent flex items-center justify-center text-white font-bold flex-shrink-0', sizes[size], className)}>
      {initials(firstName, lastName)}
    </div>
  );
}
