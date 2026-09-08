import axios, { AxiosInstance } from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ;

const api: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Helper: read stored auth state ────────────────────────────
function getStoredAuth(): { access_token?: string; refresh_token?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("mail-ai-auth");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const user = parsed?.state?.user;
    return {
      access_token:  user?.access_token,
      refresh_token: user?.refresh_token,
    };
  } catch {
    return {};
  }
}

function setStoredTokens(access_token: string, refresh_token: string) {
  try {
    const raw = localStorage.getItem("mail-ai-auth");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state?.user) {
      parsed.state.user.access_token  = access_token;
      parsed.state.user.refresh_token = refresh_token;
      localStorage.setItem("mail-ai-auth", JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

// ── Request interceptor — attach JWT ──────────────────────────
api.interceptors.request.use((config) => {
  const { access_token } = getStoredAuth();
  if (access_token) {
    config.headers["Authorization"] = `Bearer ${access_token}`;
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ────────────────
let _refreshPromise: Promise<boolean> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;

    // Map FastAPI error detail string into err.message
    const detail = err.response?.data?.detail;
    if (detail) {
      err.message = typeof detail === "string" ? detail : JSON.stringify(detail);
    }

    // Ignore 401 on login or refresh endpoint to avoid refresh loops
    const isAuthEndpoint = originalRequest?.url?.includes("/api/auth/login") || originalRequest?.url?.includes("/api/auth/refresh");

    // Attempt token refresh on 401 (once per request)
    if (status === 401 && !originalRequest._retried && !isAuthEndpoint && typeof window !== "undefined") {
      originalRequest._retried = true;
      const { refresh_token } = getStoredAuth();

      if (refresh_token) {
        // Serialize concurrent refresh attempts into one call
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post(`${BASE}/api/auth/refresh`, { refresh_token })
            .then((r) => {
              const { access_token, refresh_token: new_rt } = r.data;
              setStoredTokens(access_token, new_rt);
              // Also update in-memory Zustand store if available
              try {
                const { useAuthStore } = require("@/store/authStore");
                useAuthStore.getState().updateTokens(access_token, new_rt);
              } catch {}
              return true;
            })
            .catch(() => false)
            .finally(() => { _refreshPromise = null; });
        }

        const refreshed = await _refreshPromise;
        if (refreshed) {
          // Retry with new token
          const { access_token } = getStoredAuth();
          originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      }

      // Refresh failed or no refresh token — force logout if not on login page
      localStorage.removeItem("mail-ai-auth");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
