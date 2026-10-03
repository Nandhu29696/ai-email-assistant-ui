/**
 * Notification feed: newly finished emails become pop-ups (in-app toasts and,
 * if allowed, desktop notifications) and entries in the header bell.
 */
import { create } from "zustand";
import type { BatchItem } from "@/types";
import { outcomeLabel } from "@/lib/intake";

export type NotifyLevel = "all" | "important";

export interface NotificationPrefs {
  popups: boolean;        // in-app pop-ups
  desktop: boolean;       // browser/OS notifications (needs permission)
  level: NotifyLevel;     // "important" = needs attention, rejected, critical/high priority
}

export const DEFAULT_PREFS: NotificationPrefs = { popups: true, desktop: false, level: "all" };
const PREFS_KEY = "mailai.notifications.prefs";
const READ_KEY = "mailai.notifications.read";

export interface ActivityNotice {
  key: string;            // batch_no
  title: string;
  message: string;
  tone: "success" | "error" | "warning" | "info";
  href: string;
  at: string | null;
  important: boolean;
}

/** Turn a finished email into a notification. */
export function describe(item: BatchItem): ActivityNotice {
  const from = item.sender_name || item.sender_email;
  const subject = item.subject || "(no subject)";
  const urgent = item.priority === "critical" || item.priority === "high";
  let title: string;
  let tone: ActivityNotice["tone"];
  if (item.status === "FAILED") {
    title = "Email needs attention";
    tone = "error";
  } else if (item.status === "SUCCESS") {
    title = urgent ? `Processed · ${item.priority} priority` : "Email processed";
    tone = urgent ? "warning" : "success";
  } else if (item.status === "REJECTED") {
    title = `Rejected · ${outcomeLabel(item.outcome)}`;
    tone = "warning";
  } else {
    title = outcomeLabel(item.outcome);
    tone = "info";
  }
  return {
    key: item.batch_no,
    title,
    message: `${from} — ${subject}`,
    tone,
    href: `/emails?batch=${encodeURIComponent(item.batch_no)}`,
    at: item.processed_at,
    important: item.status === "FAILED" || item.status === "REJECTED" || urgent,
  };
}

export function shouldPopUp(notice: ActivityNotice, prefs: NotificationPrefs): boolean {
  return prefs.level === "all" || notice.important;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — preferences just won't persist
  }
}

export function loadPrefs(): NotificationPrefs {
  return readJson(PREFS_KEY, DEFAULT_PREFS);
}

interface ActivityState {
  notices: ActivityNotice[];          // newest first, max 30
  read: Record<string, true>;
  since: string | null;               // server time of the last poll
  prefs: NotificationPrefs;
  hydrate: () => void;
  ingest: (items: BatchItem[], serverTime: string, initial: boolean) => ActivityNotice[];
  markAllRead: () => void;
  markRead: (key: string) => void;
  setPrefs: (prefs: Partial<NotificationPrefs>) => void;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  notices: [],
  read: {},
  since: null,
  prefs: DEFAULT_PREFS,
  hydrate: () => set({ prefs: loadPrefs(), read: readJson<Record<string, true>>(READ_KEY, {}) }),
  /** Merge a poll result; returns the notices that are new (to pop up). The first poll only fills the history. */
  ingest: (items, serverTime, initial) => {
    const known = new Set(get().notices.map((n) => n.key));
    const fresh = items.map(describe).filter((n) => !known.has(n.key));
    const notices = [...fresh, ...get().notices].slice(0, 30);
    set({ notices, since: serverTime });
    return initial ? [] : fresh;
  },
  markAllRead: () => {
    const read = { ...get().read };
    get().notices.forEach((n) => { read[n.key] = true; });
    writeJson(READ_KEY, read);
    set({ read });
  },
  markRead: (key) => {
    const read = { ...get().read, [key]: true as const };
    writeJson(READ_KEY, read);
    set({ read });
  },
  setPrefs: (prefs) => {
    const next = { ...get().prefs, ...prefs };
    writeJson(PREFS_KEY, next);
    set({ prefs: next });
  },
}));

export function unreadCount(notices: ActivityNotice[], read: Record<string, true>): number {
  return notices.filter((n) => !read[n.key]).length;
}

/** Show an OS-level notification; clicking it focuses the app on that email. */
export function showDesktopNotification(notice: ActivityNotice) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(notice.title, { body: notice.message, icon: "/icon.svg", tag: notice.key });
    n.onclick = () => {
      window.focus();
      window.location.href = notice.href;
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker — ignore
  }
}
