import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  /** Short-lived access token kept in memory only — never persisted to disk. */
  accessToken: string | null;
  /** Non-sensitive user profile — safe to persist for UX continuity. */
  user: User | null;
  setAuth: (accessToken: string, user: User) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

/**
 * Auth store.
 *
 * Security model:
 *  - accessToken  → in-memory only (gone on page refresh, intentionally).
 *                   The silent-refresh flow re-acquires it on every mount.
 *  - refreshToken → stored as an httpOnly cookie by the API server.
 *                   JavaScript cannot read or steal it.
 *  - user         → non-sensitive profile, persisted for instant UI restore.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,

      setAuth: (accessToken, user) => set({ accessToken, user }),

      /** Called after a silent token refresh — updates the in-memory token. */
      setAccessToken: (accessToken) => set({ accessToken }),

      clearAuth: () => set({ accessToken: null, user: null }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'nexgen-auth',
      // Only persist the user profile — never tokens.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
