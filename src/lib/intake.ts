/** Labels and colours for the intake rules, shared by the dashboard and the email pages. */
import type { BatchStatus, Outcome } from "@/types";

export const OUTCOMES: Array<{ key: Outcome; label: string; rule: string; tone: Tone }> = [
  { key: "PROCESSED", label: "Processed successfully", rule: "Rule 5", tone: "green" },
  { key: "DOMAIN_NOT_ALLOWED", label: "Domain not valid", rule: "Rule 1", tone: "red" },
  { key: "NO_ATTACHMENT", label: "No attachment", rule: "Rule 3", tone: "amber" },
  { key: "INVALID_FILE_TYPE", label: "Unsupported file type", rule: "Rule 3", tone: "amber" },
  { key: "INVALID_ATTACHMENTS", label: "Protected / unreadable files", rule: "Rule 4", tone: "amber" },
  { key: "SENDER_NOT_VERIFIED", label: "Sender not verified", rule: "Safety", tone: "slate" },
  { key: "AUTOMATED_MESSAGE", label: "Automated message ignored", rule: "Safety", tone: "slate" },
  { key: "SYSTEM_ERROR", label: "System error — needs attention", rule: "System", tone: "red" },
];

export type Tone = "green" | "red" | "amber" | "slate" | "blue";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function outcomeLabel(outcome: string | null | undefined): string {
  return OUTCOMES.find((o) => o.key === outcome)?.label ?? "In progress";
}

export function outcomeTone(outcome: string | null | undefined): Tone {
  return OUTCOMES.find((o) => o.key === outcome)?.tone ?? "blue";
}

export const STATUS_TONE: Record<BatchStatus, Tone> = {
  RECEIVED: "blue",
  PROCESSING: "blue",
  REPROCESSING: "blue",
  SUCCESS: "green",
  REJECTED: "amber",
  FAILED: "red",
  IGNORED: "slate",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status as BatchStatus] ?? "slate";
}

export function isInProgress(status: string): boolean {
  return status === "RECEIVED" || status === "PROCESSING" || status === "REPROCESSING";
}

export const PRIORITY_TONE: Record<string, Tone> = { critical: "red", high: "amber", medium: "blue", low: "slate" };
export const PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const SENTIMENT_TONE: Record<string, Tone> = { positive: "green", neutral: "slate", negative: "red" };

/** Human labels for the processing timeline. */
const EVENT_LABELS: Record<string, string> = {
  RECEIVED: "Email picked up",
  ANALYZED: "Categorised and sentiment analysed",
  ANALYSIS_FAILED: "AI analysis failed (processing continued)",
  AUTOMATED_MESSAGE_IGNORED: "Automated message — ignored",
  SENDER_NOT_VERIFIED: "Sender could not be verified — not processed",
  DOMAIN_REJECTED: "Rule 1 · Domain not valid — reply sent",
  ACKNOWLEDGEMENT_SENT: "Rule 2 · Acknowledgement sent",
  NO_ATTACHMENT: "Rule 3 · No attachment — reply sent",
  INVALID_FILE_TYPE: "Rule 3 · Unsupported attachment type — reply sent",
  INVALID_ATTACHMENTS: "Rule 4 · Protected/unreadable attachments — reply sent",
  ATTACHMENTS_CONVERTED: "Rule 5.1 · Attachments converted to PDF and stored",
  EMAIL_PDF_CREATED: "Rule 5.2 · Email content PDF created",
  MERGED_PDF_STORED: "Rule 5.3/5.4 · Merged PDF stored",
  SUCCESS_REPLY: "Rule 5.4 · Success reply sent",
  SYSTEM_ERROR: "System error",
  REPROCESS_STARTED: "Reprocessing started",
  ARCHIVED: "Retention · stored PDFs deleted",
  REPROCESS_FAILED: "Reprocessing failed",
  EMAIL_MOVE_SKIPPED: "Mailbox folder move skipped",
  EMAIL_MOVE_FAILED: "Mailbox folder move failed",
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.toLowerCase().replaceAll("_", " ");
}

const ATTACHMENT_LABELS: Record<string, [string, Tone]> = {
  PENDING: ["Pending", "blue"],
  INVALID_TYPE: ["Unsupported type", "amber"],
  PROTECTED: ["Password-protected", "amber"],
  UNREADABLE: ["Unreadable", "amber"],
  NOT_PROCESSED: ["Not processed", "slate"],
  CONVERTED: ["Converted", "green"],
  MERGED: ["Converted & merged", "green"],
  FAILED: ["Failed", "red"],
};

export function attachmentStatus(status: string): [string, Tone] {
  return ATTACHMENT_LABELS[status] ?? [status, "slate"];
}
