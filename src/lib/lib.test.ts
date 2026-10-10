import { afterEach, describe, expect, it, vi } from "vitest";
import { csrfHeaders, readCookie } from "@/lib/api";
import { OUTCOMES, STATUS_TABS, attachmentStatus, eventLabel, isInProgress, nextStep, outcomeLabel, outcomeTone, progressSteps, replyLabel, repliesSent, statusTab, statusTone } from "@/lib/intake";
import { formatBytes } from "@/lib/utils";
import { errorText, showError, showSuccess, useToastStore } from "@/lib/notifications";

describe("api CSRF helpers", () => {
  afterEach(() => { document.cookie = "ea_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; });

  it("reads the CSRF cookie and builds the header for writes", () => {
    document.cookie = "ea_csrf=abc%2B123";
    expect(readCookie("ea_csrf")).toBe("abc+123");
    expect(csrfHeaders()).toEqual({ "X-CSRF-Token": "abc+123" });
  });

  it("sends no header when there is no CSRF cookie", () => {
    expect(csrfHeaders()).toEqual({});
  });
});

describe("intake labels", () => {
  it("names the rule that decided each email", () => {
    expect(outcomeLabel("DOMAIN_NOT_ALLOWED")).toBe("Sender's domain not accepted");
    expect(outcomeLabel("PROCESSED")).toBe("All files combined into one PDF");
    expect(outcomeLabel(null)).toBe("Being checked");
    expect(outcomeTone("SYSTEM_ERROR")).toBe("red");
  });

  it("maps statuses, events and attachment states", () => {
    expect(statusTone("SUCCESS")).toBe("green");
    expect(statusTone("REJECTED")).toBe("amber");
    expect(isInProgress("PROCESSING")).toBe(true);
    expect(isInProgress("FAILED")).toBe(false);
    expect(eventLabel("ACKNOWLEDGEMENT_SENT")).not.toMatch(/Rule/);
    expect(eventLabel("SOMETHING_NEW")).toBe("something new");
    expect(attachmentStatus("PROTECTED")).toEqual(["Password-protected", "amber"]);
  });

  it("formats file sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(null)).toBe("—");
  });
});

describe("toasts", () => {
  it("queues, caps and auto-dismisses toasts", () => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
    showSuccess("Saved");
    showError({ message: "Boom" });
    showError(null, "Fallback text");
    const toasts = useToastStore.getState().toasts;
    expect(toasts.map((t) => [t.kind, t.message])).toEqual([
      ["success", "Saved"], ["error", "Boom"], ["error", "Fallback text"],
    ]);
    for (let i = 0; i < 10; i++) showSuccess(`n${i}`);
    expect(useToastStore.getState().toasts).toHaveLength(5);
    vi.advanceTimersByTime(4100);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it("extracts readable error text", () => {
    expect(errorText(new Error("Nope"), "x")).toBe("Nope");
    expect(errorText("string error", "fallback")).toBe("fallback");
  });
});

describe("plain-language next steps", () => {
  it("tells the person what happened and whether to act", () => {
    const domain = nextStep({ status: "REJECTED", outcome: "DOMAIN_NOT_ALLOWED", sender_email: "a@acme.org" }, "client");
    expect(domain).toMatchObject({ needsAction: true, action: "retry" });
    expect(domain.text).toContain("acme.org");
    expect(domain.text).toContain("Mailboxes → Rules");
    expect(nextStep({ status: "REJECTED", outcome: "DOMAIN_NOT_ALLOWED" }, "admin").text).toContain("Rules & replies");
    expect(nextStep({ status: "SUCCESS", outcome: "PROCESSED", has_merged_pdf: true }, "user")).toMatchObject({ needsAction: false, action: "download" });
    expect(nextStep({ status: "REJECTED", outcome: "NO_ATTACHMENT" }, "user").needsAction).toBe(false);
    expect(nextStep({ status: "FAILED", outcome: "SYSTEM_ERROR" }, "user").text).toContain("administrator");
    expect(nextStep({ status: "PROCESSING" }, "user").text).toContain("less than a minute");
  });

  it("never shows rule numbers to end users", () => {
    for (const o of OUTCOMES) expect(o.label).not.toMatch(/Rule/);
    for (const t of ["DOMAIN_REJECTED", "ACKNOWLEDGEMENT_SENT", "ATTACHMENTS_CONVERTED", "SUCCESS_REPLY"]) expect(eventLabel(t)).not.toMatch(/Rule/);
  });

  it("groups working states into the In progress tab", () => {
    expect(statusTab("PROCESSING")).toBe("IN_PROGRESS");
    expect(statusTab("REPROCESSING")).toBe("IN_PROGRESS");
    expect(statusTab("REJECTED")).toBe("REJECTED");
    expect(statusTab(null)).toBe("");
    expect(STATUS_TABS.map((t) => t.label)).toEqual(["All", "PDF ready", "Sent back", "Needs attention", "Skipped", "In progress"]);
  });
});

describe("email detail helpers", () => {
  const ev = (...types: string[]) => types.map((event_type) => ({ event_type }));

  it("shows where an email stopped", () => {
    const states = (e: Parameters<typeof progressSteps>[0]) => progressSteps(e).map((s) => s.state);
    expect(states({ status: "SUCCESS", outcome: "PROCESSED", events: ev("RECEIVED", "ANALYZED") })).toEqual(["done", "done", "done"]);
    expect(states({ status: "REJECTED", outcome: "NO_ATTACHMENT", events: ev("RECEIVED") })).toEqual(["done", "stopped", "todo"]);
    expect(states({ status: "IGNORED", outcome: "AUTOMATED_MESSAGE", events: ev("RECEIVED") })).toEqual(["done", "skipped", "todo"]);
    expect(states({ status: "PROCESSING", events: ev("RECEIVED") })).toEqual(["done", "current", "todo"]);
    expect(states({ status: "PROCESSING", events: ev("RECEIVED", "ANALYZED") })).toEqual(["done", "done", "current"]);
    expect(states({ status: "FAILED", outcome: "SYSTEM_ERROR", events: ev("RECEIVED", "ATTACHMENTS_CONVERTED") })).toEqual(["done", "done", "error"]);
    expect(states({ status: "FAILED", outcome: "SYSTEM_ERROR", events: ev("RECEIVED") })).toEqual(["done", "error", "todo"]);
  });

  it("lists the replies the sender received", () => {
    const replies = repliesSent([
      { reply_sent: false, details: {}, created_at: "2026-10-07T10:00:00Z" },
      { reply_sent: true, details: { template: "acknowledgement", reply_to: "a@b.com", reply_subject: "Got it", reply_html: "<p>Hi</p>" }, created_at: "2026-10-07T10:00:01Z" },
      { reply_sent: false, details: { template: "success", reply_error: "SMTP down" }, created_at: "2026-10-07T10:00:05Z" },
    ]);
    expect(replies).toHaveLength(2);
    expect(replies[0]).toMatchObject({ template: "acknowledgement", sent: true, to: "a@b.com", subject: "Got it", html: "<p>Hi</p>" });
    expect(replies[1]).toMatchObject({ sent: false, error: "SMTP down", html: undefined });
    expect(replyLabel("no_attachment")).toContain("attach");
  });
});
