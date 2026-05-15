import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.user) as User | null;
}
