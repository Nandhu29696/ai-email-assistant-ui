import { create } from "zustand";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message: string;
  href?: string;          // optional "Open" link (e.g. to the email)
  durationMs?: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

const DURATION_MS = 4000;
const MAX_VISIBLE = 5;
let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => useToastStore.getState().dismiss(id), toast.durationMs ?? DURATION_MS);
    }
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function errorText(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "");
    if (message) return message;
  }
  return fallback;
}

export function showSuccess(message: string, title = "Success") {
  useToastStore.getState().push({ kind: "success", title, message });
}

export function showError(error: unknown, fallback = "Something went wrong. Please try again.") {
  useToastStore.getState().push({ kind: "error", title: "Action failed", message: errorText(error, fallback) });
}

export function showInfo(message: string, title = "Notice") {
  useToastStore.getState().push({ kind: "info", title, message });
}

/** Pop-up for something that happened in the background (e.g. a newly processed email). */
export function showActivity(kind: ToastKind, title: string, message: string, href?: string) {
  useToastStore.getState().push({ kind, title, message, href, durationMs: 8000 });
}
