"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { showActivity } from "@/lib/notifications";
import { shouldPopUp, showDesktopNotification, useActivityStore } from "@/lib/activity";
import type { BatchItem } from "@/types";

const POLL_MS = 20_000;

/**
 * Polls for emails that finished processing and announces them:
 * an in-app pop-up, a desktop notification (if allowed) and an entry in the bell.
 * The first poll only loads history, so opening the app never floods you with pop-ups.
 */
export default function ActivityWatcher() {
  const qc = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useActivityStore.getState().hydrate();
    let stopped = false;
    let timer: number | undefined;

    async function poll(initial: boolean) {
      try {
        const { since } = useActivityStore.getState();
        const { data } = await api.get<{ server_time: string; items: BatchItem[] }>("/api/document-intake/activity", {
          params: { since: initial ? undefined : since ?? undefined, limit: initial ? 20 : 50 },
        });
        if (stopped) return;
        const fresh = useActivityStore.getState().ingest(data.items, data.server_time, initial);
        const { prefs } = useActivityStore.getState();
        if (fresh.length) {
          // Lists, counts and charts elsewhere refresh straight away.
          qc.invalidateQueries({ queryKey: ["batches"] });
          qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }
        const toAnnounce = fresh.filter((n) => shouldPopUp(n, prefs)).slice(0, 5);
        for (const notice of toAnnounce) {
          if (prefs.popups) showActivity(notice.tone, notice.title, notice.message, notice.href);
          if (prefs.desktop) showDesktopNotification(notice);
        }
      } catch {
        // offline / API restarting — try again next round
      } finally {
        if (!stopped) timer = window.setTimeout(() => poll(false), POLL_MS);
      }
    }

    poll(true);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      started.current = false;
    };
  }, [qc]);

  return null;
}
