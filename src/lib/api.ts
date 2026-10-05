import axios, { AxiosInstance } from "axios";
import type { QueryClient } from "@tanstack/react-query";
import { API_BASE_URL, AUTH_STORAGE_KEY, CSRF_COOKIE, CSRF_HEADER } from "@/lib/config";
import { useAuthStore } from "@/store/authStore";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Set by <Providers> so a forced logout can also drop cached server data.
let registeredQueryClient: QueryClient | null = null;
export function registerQueryClient(client: QueryClient) {
  registeredQueryClient = client;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** Headers for state-changing requests (double-submit CSRF token). */
export function csrfHeaders(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

/** Clear the local session and every cached query (prevents the next user seeing stale data). */
export function clearSession() {
  useAuthStore.getState().logout();
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
  registeredQueryClient?.clear();
}

// ── Request interceptor — CSRF header on writes ───────────────
api.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    Object.assign(config.headers, csrfHeaders());
  }
  const accessToken = useAuthStore.getState().user?.access_token;
  if (accessToken) {
    Object.assign(config.headers, { Authorization: `Bearer ${accessToken}` });
  }
  return config;
});

// ── Token refresh (shared by HTTP and WebSocket clients) ──────
let refreshPromise: Promise<boolean> | null = null;

/** Rotate the session using the httpOnly refresh cookie. Concurrent callers share one request. */
export function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    const refreshToken = useAuthStore.getState().user?.refresh_token;
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/api/auth/refresh`,
        refreshToken ? { refresh_token: refreshToken } : undefined,
        {
          headers: refreshToken ? { "X-Auth-Mode": "token" } : undefined,
          withCredentials: true,
        },
      )
      .then(({ data }) => {
        const current = useAuthStore.getState().user;
        if (current && (data.access_token || data.refresh_token)) {
          useAuthStore.getState().setUser({
            ...current,
            access_token: data.access_token ?? current.access_token,
            refresh_token: data.refresh_token ?? current.refresh_token,
          });
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// ── Response interceptor — auto-refresh on 401 ────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;

    // Map FastAPI error detail into err.message (blob responses carry it as JSON text).
    let detail = err.response?.data?.detail;
    if (!detail && err.response?.data instanceof Blob) {
      try {
        detail = JSON.parse(await err.response.data.text()).detail;
      } catch {
        // not JSON
      }
    }
    if (detail) {
      err.message = typeof detail === "string" ? detail : JSON.stringify(detail);
    }

    const url: string = originalRequest?.url || "";
    const isAuthEndpoint = ["/api/auth/login", "/api/auth/refresh", "/api/auth/mfa/verify", "/api/auth/logout"]
      .some((path) => url.includes(path));

    if (status === 401 && originalRequest && !originalRequest._retried && !isAuthEndpoint && typeof window !== "undefined") {
      originalRequest._retried = true;
      if (await refreshTokens()) {
        return api(originalRequest);
      }
      redirectToLogin();
    } else if (status === 403 && typeof detail === "string" && detail.toLowerCase().includes("account") && detail.toLowerCase().includes("locked")) {
      redirectToLogin();
    }

    return Promise.reject(err);
  }
);

export default api;
