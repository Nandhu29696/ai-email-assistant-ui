"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import api from "@/lib/api";
import { showError, showSuccess } from "@/lib/notifications";

interface MfaStatus { enabled: boolean; recovery_codes_remaining: number }
interface MfaSetup { secret: string; otpauth_uri: string }

/** Optional TOTP two-factor authentication: enroll, show recovery codes once, disable. */
export default function MfaSection() {
  const qc = useQueryClient();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const status = useQuery<MfaStatus>({
    queryKey: ["mfa-status"],
    queryFn: () => api.get("/api/auth/mfa/status").then((r) => r.data),
  });

  const start = useMutation({
    mutationFn: () => api.post<MfaSetup>("/api/auth/mfa/setup").then((r) => r.data),
    onSuccess: (data) => { setSetup(data); setCode(""); },
    onError: (e) => showError(e, "Could not start MFA setup."),
  });

  const enable = useMutation({
    mutationFn: () => api.post<{ recovery_codes: string[] }>("/api/auth/mfa/enable", { code: code.trim() }).then((r) => r.data),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes);
      setSetup(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      showSuccess("Two-factor authentication enabled.");
    },
    onError: (e) => showError(e, "Invalid code."),
  });

  const disable = useMutation({
    mutationFn: () => api.post("/api/auth/mfa/disable", { password, code: code.trim() }),
    onSuccess: () => {
      setPassword("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      showSuccess("Two-factor authentication disabled.");
    },
    onError: (e) => showError(e, "Could not disable MFA."),
  });

  const enabled = status.data?.enabled;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Two-factor authentication</h2>
        {status.data && (
          <span className={`ml-auto text-xs font-medium ${enabled ? "text-emerald-700" : "text-slate-400"}`}>
            {enabled ? `On · ${status.data.recovery_codes_remaining} recovery codes left` : "Off"}
          </span>
        )}
      </div>

      {recoveryCodes && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Save these recovery codes now — they will not be shown again.</p>
          <p className="mt-1 text-xs">Each code can be used once if you lose access to your authenticator app.</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs">
            {recoveryCodes.map((c) => <span key={c} className="rounded bg-white px-2 py-1">{c}</span>)}
          </div>
          <button onClick={() => setRecoveryCodes(null)} className="mt-3 text-xs underline">I have saved them</button>
        </div>
      )}

      {!enabled && !setup && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Require a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) when signing in.</p>
          <button onClick={() => start.mutate()} disabled={start.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            <ShieldCheck size={14} /> Set up
          </button>
        </div>
      )}

      {!enabled && setup && (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-3"><QRCodeSVG value={setup.otpauth_uri} size={148} /></div>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Scan the QR code with your authenticator app, or enter this key manually:</p>
            <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs">{setup.secret}</code>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric"
              className="w-40 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="flex gap-2">
              <button onClick={() => enable.mutate()} disabled={enable.isPending || code.trim().length < 6}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
                {enable.isPending ? "Verifying…" : "Verify & enable"}
              </button>
              <button onClick={() => setSetup(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex flex-wrap items-end gap-2">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code or recovery code"
            className="w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={() => disable.mutate()} disabled={disable.isPending || !password || !code.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-50">
            <ShieldOff size={14} /> Disable
          </button>
        </div>
      )}
    </div>
  );
}
