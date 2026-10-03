import { afterEach, describe, expect, it, vi } from "vitest";
import { csrfHeaders, readCookie } from "@/lib/api";
import { attachmentStatus, eventLabel, isInProgress, outcomeLabel, outcomeTone, statusTone } from "@/lib/intake";
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
    expect(outcomeLabel("DOMAIN_NOT_ALLOWED")).toBe("Domain not valid");
    expect(outcomeLabel("PROCESSED")).toBe("Processed successfully");
    expect(outcomeLabel(null)).toBe("In progress");
    expect(outcomeTone("SYSTEM_ERROR")).toBe("red");
  });

  it("maps statuses, events and attachment states", () => {
    expect(statusTone("SUCCESS")).toBe("green");
    expect(statusTone("REJECTED")).toBe("amber");
    expect(isInProgress("PROCESSING")).toBe(true);
    expect(isInProgress("FAILED")).toBe(false);
    expect(eventLabel("ACKNOWLEDGEMENT_SENT")).toContain("Rule 2");
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
