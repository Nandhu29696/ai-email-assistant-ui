import { beforeEach, describe, expect, it } from "vitest";
import { describe as describeEmail, shouldPopUp, unreadCount, useActivityStore, DEFAULT_PREFS } from "@/lib/activity";
import type { BatchItem } from "@/types";

function email(overrides: Partial<BatchItem>): BatchItem {
  return {
    id: 1, batch_no: "CLM-1", sender_name: "Alice", sender_email: "alice@client.com", recipient_email: "in@ours.com",
    subject: "Claim documents", status: "SUCCESS", outcome: "PROCESSED", status_reason: null, mailbox_type: "UAT",
    attachment_count: 1, sentiment: "neutral", sentiment_score: 0, primary_emotion: "neutral", email_category: "general",
    priority: "low", ai_summary: null, has_merged_pdf: true, is_archived: false, archived_at: null,
    received_datetime: "2026-10-02T09:00:00Z", processed_at: "2026-10-02T09:00:05Z", ...overrides,
  };
}

describe("notification text", () => {
  it("describes each result", () => {
    expect(describeEmail(email({}))).toMatchObject({ title: "Email processed", tone: "success", important: false,
      message: "Alice — Claim documents", href: "/emails?batch=CLM-1" });
    expect(describeEmail(email({ status: "FAILED", outcome: "SYSTEM_ERROR" }))).toMatchObject({ title: "Email needs attention", tone: "error", important: true });
    expect(describeEmail(email({ status: "REJECTED", outcome: "DOMAIN_NOT_ALLOWED" }))).toMatchObject({ title: "Rejected · Domain not valid", tone: "warning", important: true });
    expect(describeEmail(email({ priority: "critical" }))).toMatchObject({ title: "Processed · critical priority", important: true });
  });

  it("filters to important emails when asked", () => {
    const normal = describeEmail(email({}));
    const failed = describeEmail(email({ status: "FAILED" }));
    expect(shouldPopUp(normal, { ...DEFAULT_PREFS, level: "all" })).toBe(true);
    expect(shouldPopUp(normal, { ...DEFAULT_PREFS, level: "important" })).toBe(false);
    expect(shouldPopUp(failed, { ...DEFAULT_PREFS, level: "important" })).toBe(true);
  });
});

describe("activity store", () => {
  beforeEach(() => {
    localStorage.clear();
    useActivityStore.setState({ notices: [], read: {}, since: null, prefs: DEFAULT_PREFS });
  });

  it("does not pop up history on the first load, then announces only new emails", () => {
    const { ingest } = useActivityStore.getState();
    expect(ingest([email({ batch_no: "OLD-1" }), email({ batch_no: "OLD-2" })], "t1", true)).toEqual([]);
    expect(useActivityStore.getState().notices.map((n) => n.key)).toEqual(["OLD-1", "OLD-2"]);
    const fresh = useActivityStore.getState().ingest([email({ batch_no: "NEW-1" }), email({ batch_no: "OLD-1" })], "t2", false);
    expect(fresh.map((n) => n.key)).toEqual(["NEW-1"]);
    expect(useActivityStore.getState().since).toBe("t2");
  });

  it("tracks unread and persists read state and preferences", () => {
    const store = useActivityStore.getState();
    store.ingest([email({ batch_no: "A" }), email({ batch_no: "B" })], "t", false);
    expect(unreadCount(useActivityStore.getState().notices, useActivityStore.getState().read)).toBe(2);
    useActivityStore.getState().markRead("A");
    expect(unreadCount(useActivityStore.getState().notices, useActivityStore.getState().read)).toBe(1);
    useActivityStore.getState().markAllRead();
    expect(unreadCount(useActivityStore.getState().notices, useActivityStore.getState().read)).toBe(0);
    useActivityStore.getState().setPrefs({ level: "important", popups: false });
    useActivityStore.setState({ prefs: DEFAULT_PREFS, read: {} });
    useActivityStore.getState().hydrate();
    expect(useActivityStore.getState().prefs).toMatchObject({ level: "important", popups: false });
    expect(useActivityStore.getState().read).toMatchObject({ A: true, B: true });
  });
});
