// src/hooks/useNotifications.js
//
// Polls the completed-work notifications feed (reference/am_integration_docs.md
// §6, §7) and layers a per-user "read by me" state on top of it. The feed's
// own `is_read` is a single shared flag and `read_by` is a single object (not
// a list) — so this deliberately ignores `is_read` for UI purposes and
// instead computes "have I read this" by matching `read_by.name` against the
// current user's username, mirroring how the backend is expected to
// populate read_by from the Token-authenticated caller on mark-read.
import { useCallback, useEffect, useRef, useState } from "react";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { opsApi } from "../api/opsClient";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 60000;

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sinceRef = useRef(null);

  const poll = useCallback((signal) => {
    return mukkadamIntegrationApi
      .getCompletedWorkNotifications({ since: sinceRef.current ?? undefined }, signal)
      .then((data) => {
        sinceRef.current = data.next_since;
        if (data.results?.length) {
          setNotifications((prev) => {
            const byId = new Map(prev.map((n) => [n.id, n]));
            for (const n of data.results) byId.set(n.id, n);
            return Array.from(byId.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          });
        }
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    poll(controller.signal);
    const interval = setInterval(() => poll(), POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [user, poll]);

  const isReadByMe = useCallback(
    (notification) => {
      const readBy = notification.read_by;

      if (!Array.isArray(readBy)) {
        return false;
      }

      return readBy.some(
        (reader) => reader.name === user?.username,
      );
    },
    [user],
  );

  const unreadCount = notifications.filter((n) => !isReadByMe(n)).length;

  const markAsRead = useCallback(
    (ids) => {
      if (!ids?.length || !user?.username) return;

      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => {
          if (!ids.includes(notification.id)) {
            return notification;
          }

          const existingReadBy = Array.isArray(notification.read_by) ? notification.read_by : [];

          // Don't add the same user twice.
          const alreadyRead = existingReadBy.some((reader) => reader.name === user.username);

          if (alreadyRead) {
            return notification;
          }

          return {
            ...notification,
            read_by: [
              ...existingReadBy,
              {
                id: user.id ?? null,
                name: user.username,
                read_at: readAt,
              },
            ],
          };
        }),
      );

      opsApi.markNotificationsRead(ids).catch(() => { });
    },
    [user],
  );

  return { notifications, unreadCount, loading, error, isReadByMe, markAsRead };
}
