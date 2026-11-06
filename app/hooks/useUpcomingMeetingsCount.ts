"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { INBOX_UPDATED_EVENT } from "@/app/lib/inbox-events";

/**
 * Hook to retrieve and subscribe to the number of upcoming accepted 1-on-1 meetings.
 * - Queries /api/mentor-planner/inbox?countOnly=true with the user session
 * - Subscribes to Supabase Realtime changes on `calendar_events`
 * - Listens for window focus, custom "inbox-updated" events, and 60-second timer to auto-roll off expired sessions
 */
export function useUpcomingMeetingsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const isFetchingRef = useRef(false);

  const fetchCount = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCount(0);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/mentor-planner/inbox?countOnly=true", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      }
    } catch (err) {
      console.error("[useUpcomingMeetingsCount] Failed to fetch count:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const handleInboxUpdated = () => {
      if (!cancelled) {
        void fetchCount();
      }
    };

    const handleFocus = () => {
      if (!cancelled) {
        void fetchCount();
      }
    };

    window.addEventListener(INBOX_UPDATED_EVENT, handleInboxUpdated);
    window.addEventListener("focus", handleFocus);

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user || cancelled) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      await fetchCount();

      if (cancelled) return;

      // Realtime subscription on calendar_events table
      const channelName = `inbox-badge-${userId}-${Math.random().toString(36).substring(2, 9)}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "calendar_events",
          },
          () => {
            if (!cancelled) {
              void fetchCount();
            }
          }
        )
        .subscribe();

      // 60-second periodic refresh so meetings that expire roll off without refresh
      intervalId = setInterval(() => {
        if (!cancelled) {
          void fetchCount();
        }
      }, 60000);
    }

    void init();

    return () => {
      cancelled = true;
      window.removeEventListener(INBOX_UPDATED_EVENT, handleInboxUpdated);
      window.removeEventListener("focus", handleFocus);
      if (channel) {
        void supabase.removeChannel(channel);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
}
