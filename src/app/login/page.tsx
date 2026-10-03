"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { showError } from "@/lib/notifications";
import { API_BASE_URL } from "@/lib/config";
import Logo from "@/components/UI/Logo";

interface LoginResponse {
  user_id: number;
  username: string;
  full_name?: string | null;
  role: "admin" | "client";
  mfa_enabled?: boolean;
  mfa_required?: boolean;
  mfa_token?: string;
}

const inputClass =
  "w-full border border-slate-200 rounded-xl py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!err.response) return "Cannot reach the server. Check that the API is running.";
  }
  return fallback;
}

export default function LoginPage() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode,  setMfaCode]  = useState("");

  function finishLogin(data: LoginResponse) {
    // The session lives in httpOnly cookies set by the API; only the profile is kept here.
    setUser({
      user_id:     data.user_id,
      username:    data.username,
      full_name:   data.full_name ?? null,
      role:        data.role,
      mfa_enabled: data.mfa_enabled,
    });
    router.push("/dashboard");
  }

  function fail(err: unknown, fallback: string) {
    const msg = errorMessage(err, fallback);
    setError(msg);
    showError({ message: msg }, "Login failed.");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams({ username, password });
      const { data } = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/login`,
        form.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, withCredentials: true },
      );
      if (data.mfa_required && data.mfa_token) {
        setMfaToken(data.mfa_token);
        setPassword("");
        return;
      }
      finishLogin(data);
    } catch (err: unknown) {
      fail(err, "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/mfa/verify`,
        { mfa_token: mfaToken, code: mfaCode.trim() },
        { withCredentials: true },
      );
      finishLogin(data);
    } catch (err: unknown) {
      if (errorMessage(err, "").toLowerCase().includes("expired")) {
        setMfaToken(null);
        setMfaCode("");
      }
      fail(err, "Invalid authentication code.");
    } finally {
      setLoading(false);
    }
  }

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );

  const submitButton = (label: string, busyLabel: string) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {busyLabel}
        </span>
      ) : label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-violet-600/25 blur-3xl" />
        </div>
        <div className="relative"><Logo dark /></div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">Every document email,<br />handled automatically.</h2>
          <p className="mt-3 max-w-md text-sm text-slate-300">
            New emails are picked up, analysed and answered by clear rules — then the attachments are converted and merged into one PDF.
          </p>
          <ol className="mt-8 space-y-3">
            {[
              ["Check the sender's domain", "Unknown domains get a polite reply."],
              ["Acknowledge the email", "The sender knows it arrived."],
              ["Validate every attachment", "Missing, unsupported or locked files are listed back."],
              ["Convert, merge and store", "One PDF per email, with a success reply."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-indigo-200 ring-1 ring-white/15">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-xs text-slate-500">Secured with httpOnly session cookies and optional two-factor authentication.</p>
      </aside>

      {/* Sign-in panel */}
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-6 lg:hidden"><Logo /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{mfaToken ? "Two-step verification" : "Welcome back"}</h1>
            <p className="mt-1 text-sm text-slate-500">{mfaToken ? "One more step to sign in." : "Sign in to manage your email intake."}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {mfaToken ? (
            <form onSubmit={handleMfa} className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3.5 text-sm text-indigo-800">
                <ShieldCheck size={18} className="mt-0.5 flex-shrink-0" />
                <span>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</span>
              </div>
              <input
                autoFocus
                autoComplete="one-time-code"
                aria-label="Authentication code"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className={`${inputClass} px-4 text-center text-lg tracking-widest`}
              />
              {errorBox}
              {submitButton("Verify", "Verifying…")}
              <button
                type="button"
                onClick={() => { setMfaToken(null); setMfaCode(""); setError(""); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className={`${inputClass} pl-10 pr-4`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`${inputClass} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {errorBox}
              {submitButton("Sign in", "Signing in…")}
            </form>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
