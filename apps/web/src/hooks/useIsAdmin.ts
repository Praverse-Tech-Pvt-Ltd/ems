import { ADMIN_ROLES } from '@/lib/constants';
import { useCurrentUser } from './useCurrentUser';

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return !!user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);
}
