"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, CheckCheck, Loader2 } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import {
  getMentionNotifications,
  markAllMentionNotificationsRead,
  markMentionNotificationRead,
  type MentionNotification,
} from "@/app/actions/mention-notifications";

interface MentionNotificationsBellProps {
  communitiesPath: "/communities" | "/admin/communities";
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function MentionNotificationsBell({
  communitiesPath,
}: MentionNotificationsBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (token: string) => {
    const { notifications: items, unreadCount: count } =
      await getMentionNotifications(token);
    setNotifications(items);
    setUnreadCount(count);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;

      setUserId(session.user.id);
      setAccessToken(session.access_token);
      await loadNotifications(session.access_token);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    // Use a unique channel name per render cycle to avoid reusing an already-subscribed channel
    const channelName = `mention-notifications-${userId}-${Date.now()}`;
    let active = true;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mention_notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        async () => {
          if (active && accessToken) {
            await loadNotifications(accessToken);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, accessToken, loadNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (notification: MentionNotification) => {
    if (!accessToken) return;

    if (!notification.read_at) {
      await markMentionNotificationRead(accessToken, notification.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setOpen(false);
    router.push(`${communitiesPath}?course=${notification.course_id}`);
  };

  const handleMarkAllRead = async () => {
    if (!accessToken || unreadCount === 0) return;

    await markAllMentionNotificationsRead(accessToken);
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, read_at: item.read_at ?? now })),
    );
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-primary"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread mention notifications`
            : "Mention notifications"
        }
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Mentions</p>
              <p className="text-xs text-gray-500">
                When someone tags you in community chat
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primary/5"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <AtSign size={18} />
                </div>
                <p className="text-sm font-medium text-gray-700">No mentions yet</p>
                <p className="mt-1 text-xs text-gray-500">
                  You&apos;ll be notified here when someone tags you.
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.read_at;
                const senderLabel =
                  notification.sender_name?.trim() || "Someone";

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={[
                      "flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50",
                      isUnread ? "bg-brand-primary/[0.04]" : "bg-white",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isUnread
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "bg-gray-100 text-gray-500",
                      ].join(" ")}
                    >
                      <AtSign size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{senderLabel}</span>{" "}
                        tagged you
                        {notification.course_title ? (
                          <>
                            {" "}
                            in{" "}
                            <span className="font-medium text-brand-primary">
                              {notification.course_title}
                            </span>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {notification.message_preview}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {formatRelativeTime(notification.created_at)}
                      </p>
                    </div>

                    {isUnread && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
