"use client";

import { useEffect, useState } from "react";
import { Bell, MonitorSmartphone } from "lucide-react";
import { showDesktopNotification, useActivityStore, type NotifyLevel } from "@/lib/activity";
import { showActivity, showError, showSuccess } from "@/lib/notifications";

type Permission = NotificationPermission | "unsupported";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Per-browser notification preferences: in-app pop-ups, desktop notifications and which emails to announce. */
export default function NotificationSection() {
  const prefs = useActivityStore((s) => s.prefs);
  const setPrefs = useActivityStore((s) => s.setPrefs);
  const [permission, setPermission] = useState<Permission>("default");

  useEffect(() => {
    useActivityStore.getState().hydrate();
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  async function enableDesktop(enabled: boolean) {
    if (!enabled) { setPrefs({ desktop: false }); return; }
    if (permission === "unsupported") { showError(null, "This browser does not support desktop notifications."); return; }
    const result = permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setPrefs({ desktop: true });
      showSuccess("Desktop notifications are on.");
    } else {
      showError(null, "Desktop notifications are blocked. Allow notifications for this site in your browser settings.");
    }
  }

  function sendTest() {
    const notice = {
      key: `test-${Date.now()}`, title: "Email processed", message: "Alice <alice@client.com> — Claim documents",
      tone: "success" as const, href: "/emails", at: new Date().toISOString(), important: false,
    };
    if (prefs.popups) showActivity(notice.tone, notice.title, notice.message, notice.href);
    if (prefs.desktop) showDesktopNotification(notice);
    if (!prefs.popups && !prefs.desktop) showError(null, "Turn on pop-ups or desktop notifications first.");
  }

  return (
    <section id="notifications" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Bell size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Notifications</h2>
        <button onClick={sendTest} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Show a test notification
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Pop-ups in the app</p>
            <p className="text-xs text-slate-500">A pop-up appears when an email has been processed while you are using MailAI.</p>
          </div>
          <Toggle label="Pop-ups in the app" checked={prefs.popups} onChange={(v) => setPrefs({ popups: v })} />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><MonitorSmartphone size={14} /> Desktop notifications</p>
            <p className="text-xs text-slate-500">
              Show a system notification even when this tab is in the background.
              {permission === "denied" && <span className="block text-red-600">Blocked by the browser — allow notifications for this site to use them.</span>}
              {permission === "unsupported" && <span className="block text-slate-400">Not supported by this browser.</span>}
            </p>
          </div>
          <Toggle label="Desktop notifications" checked={prefs.desktop && permission === "granted"} onChange={enableDesktop} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Notify me about</p>
            <p className="text-xs text-slate-500">&ldquo;Important&rdquo; = needs attention, rejected by a rule, or critical/high priority.</p>
          </div>
          <select value={prefs.level} onChange={(e) => setPrefs({ level: e.target.value as NotifyLevel })} aria-label="Notify me about"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
            <option value="all">Every processed email</option>
            <option value="important">Important emails only</option>
          </select>
        </div>
      </div>
    </section>
  );
}
