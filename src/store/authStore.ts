import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_STORAGE_KEY } from "@/lib/config";

/**
 * Signed-in user's profile and optional API-client tokens.
 */
export interface AuthUser {
  user_id:      number;
  username:     string;
  full_name:    string | null;
  role:         "admin" | "client";
  mfa_enabled?: boolean;
  access_token?: string;
  refresh_token?: string;
}

interface AuthStore {
  user:          AuthUser | null;
  hydrated:      boolean;
  setUser:       (user: AuthUser) => void;
  logout:        () => void;
  isAuthenticated: () => boolean;
  setHydrated:   (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:      null,
      hydrated:  false,
      setUser:   (user) => set({ user }),
      logout:    () => set({ user: null }),
      isAuthenticated: () => !!get().user,
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 2, // v1 persisted tokens; they are dropped on upgrade
      migrate: (persisted) => {
        const user = (persisted as { user?: AuthUser })?.user;
        if (!user) return { user: null };
        return {
          user: {
            user_id: user.user_id, username: user.username, full_name: user.full_name,
            role: user.role, mfa_enabled: user.mfa_enabled,
            access_token: user.access_token, refresh_token: user.refresh_token,
          },
        };
      },
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => { state?.setHydrated(true); },
    }
  )
);
