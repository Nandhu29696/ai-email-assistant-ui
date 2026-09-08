import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id:      number;
  username:     string;
  full_name:    string | null;
  role:         "admin" | "client";
  access_token: string;
  refresh_token?: string;
}

interface AuthStore {
  user:          AuthUser | null;
  hydrated:      boolean;
  setUser:       (user: AuthUser) => void;
  updateTokens:  (access_token: string, refresh_token: string) => void;
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
      updateTokens: (access_token, refresh_token) => {
        const user = get().user;
        if (user) set({ user: { ...user, access_token, refresh_token } });
      },
      logout:    () => set({ user: null }),
      isAuthenticated: () => !!get().user,
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: "mail-ai-auth",
      onRehydrateStorage: () => (state) => { state?.setHydrated(true); },
    }
  )
);
