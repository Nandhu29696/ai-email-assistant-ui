"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useEmailStore } from "@/store/emailStore";
import type { Notification } from "@/types";
import { showError, showSuccess } from "@/lib/notifications";

export function useNotifications() {
  const qc = useQueryClient();
  const { setNotifications, addNotification, markNotificationRead } =
    useEmailStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch
  const query = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get(
        "/api/analysis/notifications?unread_only=false&limit=50"
      );
      return data;
    },
  });

  // Sync fetched data into Zustand store (replaces deprecated onSuccess)
  useEffect(() => {
    if (query.data) {
      setNotifications(query.data);
    }
  }, [query.data, setNotifications]);

  // WebSocket for live updates with auto-reconnection
  useEffect(() => {
    let isMounted = true;

    function connectWs() {
      if (!isMounted) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const wsUrl =
        process.env.NEXT_PUBLIC_WS_URL?.replace(/^http/, "ws") ||
        "ws://187.127.166.46:5000";
      let accessToken = "";
      try {
        const raw = localStorage.getItem("mail-ai-auth");
        accessToken = JSON.parse(raw ?? "{}").state?.user?.access_token ?? "";
      } catch {
        accessToken = "";
      }
      if (!accessToken) return;
      const ws = new WebSocket(
        `${wsUrl}/ws/notifications?access_token=${encodeURIComponent(accessToken)}`
      );
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "ping") return;
          if (data.id && data.title) {
            addNotification(data as Notification);
          }
          qc.invalidateQueries({ queryKey: ["notifications"] });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        }
      };
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [addNotification, qc]);

  const markRead = useMutation({
    mutationFn: (id: string | number) =>
      api.patch(`/api/analysis/notifications/${id}/read`),
    onSuccess: (_data, id) => markNotificationRead(id),
    onError: (error) => showError(error, "Could not mark the notification as read."),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/api/analysis/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      showSuccess("Notifications marked as read.");
    },
    onError: (error) => showError(error, "Could not mark notifications as read."),
  });

  return { query, markRead, markAllRead };
}
