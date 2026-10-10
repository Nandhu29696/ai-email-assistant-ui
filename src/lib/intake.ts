/**
 * Plain-language labels for what happened to each email, shared by every page.
 * End users never see rule numbers; `rule` is kept only as a tooltip for admins.
 */
import type { BatchStatus, Outcome, UserRole } from "@/types";

export const OUTCOMES: Array<{ key: Outcome; label: string; rule: string; tone: Tone }> = [
  { key: "PROCESSED", label: "All files combined into one PDF", rule: "Rule 5", tone: "green" },
  { key: "DOMAIN_NOT_ALLOWED", label: "Sender's domain not accepted", rule: "Rule 1", tone: "red" },
  { key: "NO_ATTACHMENT", label: "No attachment", rule: "Rule 3", tone: "amber" },
  { key: "INVALID_FILE_TYPE", label: "File type not accepted", rule: "Rule 3", tone: "amber" },
  { key: "INVALID_ATTACHMENTS", label: "File locked or unreadable", rule: "Rule 4", tone: "amber" },
  { key: "SENDER_NOT_VERIFIED", label: "Sender failed the security check", rule: "Safety", tone: "slate" },
  { key: "AUTOMATED_MESSAGE", label: "Automatic email (out-of-office, newsletter…)", rule: "Safety", tone: "slate" },
  { key: "SYSTEM_ERROR", label: "Something went wrong on our side", rule: "System", tone: "red" },
];

/** Status tabs on Processed emails, in the order a person reads them. IN_PROGRESS groups the three working states. */
export const STATUS_TABS: Array<{ key: string; label: string; hint: string }> = [
  { key: "", label: "All", hint: "Every email" },
  { key: "SUCCESS", label: "PDF ready", hint: "Checked and combined into one PDF" },
  { key: "REJECTED", label: "Sent back", hint: "The sender was asked to fix something" },
  { key: "FAILED", label: "Needs attention", hint: "Something went wrong — try again" },
  { key: "IGNORED", label: "Skipped", hint: "Automatic emails that are never answered" },
  { key: "IN_PROGRESS", label: "In progress", hint: "Being checked right now" },
];

/** Old links use a single working status; they all belong to the In progress tab. */
export function statusTab(status: string | null | undefined): string {
  if (!status) return "";
  return isInProgress(status) ? "IN_PROGRESS" : status;
}

export interface NextStep {
  /** One or two plain sentences: what already happened and what (if anything) to do. */
  text: string;
  /** Does a person need to do something? */
  needsAction: boolean;
  /** Button to show with it. */
  action?: "retry" | "download";
}

/** What happens next for an email — shown on the list (tooltip) and at the top of its details. */
export function nextStep(
  email: { status: string; outcome?: string | null; sender_email?: string | null; has_merged_pdf?: boolean },
  role: UserRole | undefined,
): NextStep {
  const admin = role === "admin";
  const domain = email.sender_email?.split("@")[1];
  const allowedSendersAt = admin
    ? "Rules & replies → Allowed sender domains (or per mailbox under Mailboxes → Rules)"
    : "Mailboxes → Rules → Allowed sender domains";
  if (isInProgress(email.status)) {
    return { text: "This email is being checked right now. It usually takes less than a minute, and this page updates by itself.", needsAction: false };
  }
  switch (email.outcome) {
    case "PROCESSED":
      return {
        text: "Done. Every attachment was converted and combined into one PDF, and the sender got a confirmation.",
        needsAction: false, action: email.has_merged_pdf ? "download" : undefined,
      };
    case "DOMAIN_NOT_ALLOWED":
      return {
        text: `The sender was told their email address isn't accepted. If ${domain ? `${domain}` : "this sender"} should be allowed, add it under ${allowedSendersAt}, then click Try again.`,
        needsAction: true, action: "retry",
      };
    case "NO_ATTACHMENT":
      return { text: "The sender was asked to send the email again with the documents attached. Nothing to do here — their new email is processed automatically.", needsAction: false };
    case "INVALID_FILE_TYPE":
      return {
        text: "The sender was asked to send the files again in an accepted format (for example PDF or Word). To accept this file type instead, change Accepted file types under Mailboxes → Rules, then click Try again.",
        needsAction: false, action: "retry",
      };
    case "INVALID_ATTACHMENTS":
      return { text: "The sender was asked to send the files again without a password and undamaged. Nothing to do here — their new email is processed automatically.", needsAction: false };
    case "SENDER_NOT_VERIFIED":
      return { text: "This email failed the sender security check (it may be forged), so no reply was sent. If you know the sender, ask them to send it again.", needsAction: false };
    case "AUTOMATED_MESSAGE":
      return { text: "Automatic emails such as out-of-office replies, newsletters and alerts are skipped and never answered. Nothing to do.", needsAction: false };
    case "SYSTEM_ERROR":
      return {
        text: admin
          ? "Something went wrong while processing this email. Click Try again. If it keeps failing, check Users & jobs → Failed jobs and the Logs."
          : "Something went wrong on our side while processing this email. Click Try again; if it keeps failing, contact your administrator.",
        needsAction: true, action: "retry",
      };
    default:
      return email.status === "FAILED"
        ? { text: "Something went wrong while processing this email. Click Try again.", needsAction: true, action: "retry" }
        : { text: "", needsAction: false };
  }
}

export type Tone = "green" | "red" | "amber" | "slate" | "blue";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function outcomeLabel(outcome: string | null | undefined): string {
  return OUTCOMES.find((o) => o.key === outcome)?.label ?? "Being checked";
}

/** "Rule 3" etc. — for admin tooltips only. */
export function outcomeRule(outcome: string | null | undefined): string | undefined {
  return OUTCOMES.find((o) => o.key === outcome)?.rule;
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
  RECEIVED: "Email received",
  ANALYZED: "Read by AI (topic, tone and priority)",
  ANALYSIS_FAILED: "AI reading failed (processing continued)",
  AUTOMATED_MESSAGE_IGNORED: "Automatic email — skipped",
  SENDER_NOT_VERIFIED: "Sender failed the security check — not processed",
  DOMAIN_REJECTED: "Sender's domain not accepted — reply sent",
  ACKNOWLEDGEMENT_SENT: "\"We received your email\" reply sent",
  NO_ATTACHMENT: "No attachment — reply sent asking for the documents",
  INVALID_FILE_TYPE: "File type not accepted — reply sent",
  INVALID_ATTACHMENTS: "File locked or unreadable — reply sent",
  ATTACHMENTS_CONVERTED: "Attachments converted to PDF",
  EMAIL_PDF_CREATED: "Email text saved as a PDF",
  MERGED_PDF_STORED: "Everything combined into one PDF",
  SUCCESS_REPLY: "\"All done\" reply sent",
  SYSTEM_ERROR: "Something went wrong",
  REPROCESS_STARTED: "Trying again",
  ARCHIVED: "Stored PDFs deleted (retention period ended)",
  REPROCESS_FAILED: "Trying again failed",
  EMAIL_MOVE_SKIPPED: "Not moved to a mailbox folder",
  EMAIL_MOVE_FAILED: "Could not move to a mailbox folder",
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

// ── Email detail: progress tracker and replies ────────────────
export type StepState = "done" | "current" | "stopped" | "skipped" | "error" | "todo";

/** Received → Checked → PDF ready, and where the email stopped. */
export function progressSteps(email: {
  status: string; outcome?: string | null; events: Array<{ event_type: string }>;
}): Array<{ label: string; state: StepState; note: string }> {
  const seen = new Set(email.events.map((e) => e.event_type));
  // These only happen once every check has passed.
  const passedChecks = ["ANALYZED", "ATTACHMENTS_CONVERTED", "EMAIL_PDF_CREATED", "MERGED_PDF_STORED"].some((t) => seen.has(t));
  const working = isInProgress(email.status);

  let checked: { state: StepState; note: string };
  if (email.status === "SUCCESS" || passedChecks) checked = { state: "done", note: "Sender and files are OK" };
  else if (working) checked = { state: "current", note: "Checking the sender and files…" };
  else if (email.status === "REJECTED") checked = { state: "stopped", note: `Sent back: ${outcomeLabel(email.outcome).toLowerCase()}` };
  else if (email.status === "IGNORED") checked = { state: "skipped", note: "Automatic email — skipped" };
  else checked = { state: "error", note: "Something went wrong" };

  let pdf: { state: StepState; note: string };
  if (email.status === "SUCCESS") pdf = { state: "done", note: "Combined PDF stored" };
  else if (working && passedChecks) pdf = { state: "current", note: "Creating the PDF…" };
  else if (email.status === "FAILED" && passedChecks) pdf = { state: "error", note: "Something went wrong" };
  else pdf = { state: "todo", note: working ? "" : "Not created" };

  return [
    { label: "Received", state: "done", note: "Picked up from the mailbox" },
    { label: "Checked", ...checked },
    { label: "PDF ready", ...pdf },
  ];
}

const REPLY_LABELS: Record<string, string> = {
  acknowledgement: "“We received your email”",
  domain_rejected: "“Your email address isn't accepted”",
  no_attachment: "“Please attach your documents”",
  invalid_file_type: "“Please send the files in an accepted format”",
  invalid_attachments: "“A file is locked or unreadable”",
  success: "“All done — your documents were received”",
};

export function replyLabel(template: string): string {
  return REPLY_LABELS[template] ?? template.replaceAll("_", " ");
}

export interface SentReply {
  template: string; sent: boolean; at: string | null;
  to?: string; subject?: string; html?: string; error?: string;
}

/** Automatic replies recorded on an email's events (subject/body only on newer emails). */
export function repliesSent(events: Array<{ reply_sent: boolean; details: Record<string, unknown>; created_at: string | null }>): SentReply[] {
  const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return events
    .filter((e) => typeof e.details?.template === "string")
    .map((e) => ({
      template: e.details.template as string,
      sent: e.reply_sent,
      at: e.created_at,
      to: text(e.details.reply_to),
      subject: text(e.details.reply_subject),
      html: text(e.details.reply_html),
      error: text(e.details.reply_error),
    }));
}
