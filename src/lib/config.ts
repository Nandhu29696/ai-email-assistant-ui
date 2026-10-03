// Public endpoints are baked in at build time from NEXT_PUBLIC_* env vars.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

export const WS_BASE_URL = (
  process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL
).replace(/^http/, "ws").replace(/\/$/, "");

export const AUTH_STORAGE_KEY = "mail-ai-auth";

// Must match the backend's cookie/header names (app/routers/auth.py).
export const CSRF_COOKIE = "ea_csrf";
export const CSRF_HEADER = "X-CSRF-Token";
