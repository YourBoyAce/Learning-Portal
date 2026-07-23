"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useTransition,
} from "react";
import { supabase } from "@/app/lib/supabase";
import {
  fetchInitialMessages,
  fetchOlderMessages,
  sendCourseMessage,
  deleteCourseMessage,
  type ChatMessage,
  type FetchMessagesError,
} from "@/app/actions/community-chat";
import UserAvatar from "@/app/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  ChevronUp,
  Lock,
  Trash2,
} from "lucide-react";

interface CommunityChatPanelProps {
  courseId: string;
}

// ─── Timestamp formatter ──────────────────────────────────────────────────────

function formatTimestamp(isoString: string): string {
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

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  isAdmin,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const displayName =
    message.full_name?.trim() || `User ${message.user_id.slice(0, 6)}`;
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex items-start gap-2.5 group ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="shrink-0 mt-0.5">
        <UserAvatar name={displayName} size={28} textSize="text-[10px]" />
      </div>

      <div
        className={`flex flex-col gap-1 max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}
      >
        <div
          className={`flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-xs font-bold text-gray-800 truncate max-w-[120px]">
            {isOwn ? "You" : displayName}
          </span>
          <span className="text-[10px] text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {formatTimestamp(message.created_at)}
          </span>
          {isAdmin && !isOwn && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-1"
              title="Delete user message"
            >
              {isDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
            </button>
          )}
        </div>

        <div
          className={`
            px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
            bg-brand-heading text-white
            ${isOwn ? "rounded-tr-sm" : "rounded-tl-sm"}
          `}
        >
          {message.content}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-left">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-brand-heading mb-2">Delete Message</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Are you sure you want to delete this message? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsDeleting(true);
                    await onDelete(message.id);
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommunityChatPanel({ courseId }: CommunityChatPanelProps) {
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<FetchMessagesError | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isInitialScrollDone = useRef(false);

  // ─── Scroll helpers ───────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Stable ref so the realtime callback can call scrollToBottom
  // without it needing to be listed as a useEffect dependency.
  const scrollToBottomRef = useRef(scrollToBottom);
  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  const preserveScrollPositionFor = useCallback(
    async (action: () => Promise<void>) => {
      const container = scrollContainerRef.current;
      if (!container) {
        await action();
        return;
      }
      const prevScrollHeight = container.scrollHeight;
      await action();
      // Restore scroll so the user stays at the same visual position
      requestAnimationFrame(() => {
        container.scrollTop =
          container.scrollHeight - prevScrollHeight + container.scrollTop;
      });
    },
    [],
  );

  // ─── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    async function loadMessages() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (isMounted) {
            setError({ type: "UNKNOWN", message: "User not authenticated" });
            setLoadingInitial(false);
        }
        return;
      }
      
      const currentUserId = session.user.id;
      let currentUserName = session.user.email?.split("@")[0] || "User";
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUserId)
        .single();
        
      if (profile?.full_name) {
          currentUserName = profile.full_name;
      }
      
      if (isMounted) {
          setUserId(currentUserId);
          setUserName(currentUserName);
          setAccessToken(session.access_token);
      }

      const { data: readData } = await supabase
        .from("community_reads")
        .select("last_read_at")
        .eq("user_id", currentUserId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (isMounted && readData?.last_read_at) {
        setLastReadAt(readData.last_read_at);
      }

      // Update the read receipt for this course since the user just opened it.
      // This is done after we grab the old value so we can scroll to the right spot.
      supabase.from("community_reads").upsert({
        user_id: currentUserId,
        course_id: courseId,
        last_read_at: new Date().toISOString()
      }).then();

      const { messages: initialMessages, isAdmin, error: fetchError } = await fetchInitialMessages(
        courseId,
        session.access_token,
      );

      if (!isMounted) return;

      if (fetchError) {
        if (fetchError.type === "NOT_ENROLLED") {
          setIsEnrolled(false);
        } else {
          setError(fetchError);
        }
        setLoadingInitial(false);
        return;
      }

      setMessages(initialMessages || []);
      if (isAdmin) setIsAdminUser(true);
      setHasMore(initialMessages!.length === 50);
      setIsEnrolled(true);
      setLoadingInitial(false);
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [courseId, userId]);

  // ─── Scroll to bottom after initial load ─────────────────────────────────

  useEffect(() => {
    if (!loadingInitial && !isInitialScrollDone.current) {
      isInitialScrollDone.current = true;
      
      if (lastReadAt) {
        const unreadIndex = messages.findIndex(m => new Date(m.created_at) > new Date(lastReadAt));
        if (unreadIndex !== -1) {
          const targetMsg = unreadIndex > 0 ? messages[unreadIndex - 1] : messages[0];
          const el = document.getElementById(`msg-${targetMsg.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "instant", block: "start" });
            return;
          }
        }
      }
      
      scrollToBottom("instant" as ScrollBehavior);
    }
  }, [loadingInitial, messages, lastReadAt, scrollToBottom]);

  // ─── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    const channelId = `community-chat-${courseId}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "course_messages",
          filter: `course_id=eq.${courseId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            id: string;
            course_id: string;
            user_id: string;
            content: string;
            created_at: string;
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;

            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", newRow.user_id)
              .maybeSingle()
              .then(({ data }) => {
                const incomingMessage: ChatMessage = {
                  id: newRow.id,
                  course_id: newRow.course_id,
                  user_id: newRow.user_id,
                  content: newRow.content,
                  created_at: newRow.created_at,
                  full_name: data?.full_name ?? null,
                };

                setMessages((current) => {
                  if (current.some((m) => m.id === newRow.id)) return current;
                  
                  const filtered = current.filter(m => 
                    !(m.id.startsWith("optimistic-") && m.content === incomingMessage.content && m.user_id === incomingMessage.user_id)
                  );

                  return [...filtered, incomingMessage];
                });

                const container = scrollContainerRef.current;
                if (container) {
                  const distanceFromBottom =
                    container.scrollHeight -
                    container.scrollTop -
                    container.clientHeight;
                  if (distanceFromBottom < 120) {
                    setTimeout(() => scrollToBottomRef.current(), 50);
                  }
                }
              });

            return prev;
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [courseId]);


  // ─── Infinite scroll ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingOlder) {
          const oldestTimestamp = messages[0]?.created_at;
          if (!oldestTimestamp) return;

          setLoadingOlder(true);
          preserveScrollPositionFor(async () => {
            const { messages: older, error: olderError } =
              await fetchOlderMessages(courseId, userId, oldestTimestamp);

            if (!olderError && older.length > 0) {
              setMessages((prev) => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueOlder = older.filter(m => !existingIds.has(m.id));
                return [...uniqueOlder, ...prev];
              });
              setHasMore(older.length === 50);
            } else {
              setHasMore(false);
            }
            setLoadingOlder(false);
          });
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, messages, courseId, userId, preserveScrollPositionFor]);

  // ─── Message actions ──────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isPending) return;

    setSendError(null);

    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      course_id: courseId,
      user_id: userId,
      content: trimmed,
      created_at: new Date().toISOString(),
      full_name: userName || null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue("");

    setTimeout(() => scrollToBottom(), 50);

    startTransition(async () => {
      if (!accessToken) return;
      const { message: confirmed, error: sendErr } = await sendCourseMessage(
        accessToken,
        courseId,
        trimmed,
      );

      if (sendErr) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputValue(trimmed);
        setSendError(sendErr);
        return;
      }

      if (confirmed) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? confirmed : m)),
        );
      }
    });
  }, [inputValue, isPending, courseId, userId, userName, scrollToBottom]);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    if (!accessToken) return;
    const { success, error } = await deleteCourseMessage(accessToken, msgId);
    if (success) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } else {
      alert(error || "Failed to delete message.");
    }
  }, [userId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        <ChatHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={24} className="animate-spin text-brand-heading" />
            <p className="text-xs font-bold uppercase tracking-widest">
              Loading Community
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        <ChatHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gray-50/50">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={20} className="text-gray-400" />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
              Access Restricted
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              You must be enrolled in this course to view and participate in the
              community.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        <ChatHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
              Failed to Load
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              {error.message}
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoadingInitial(true);
                fetchInitialMessages(courseId, userId).then(({ messages: m, error: e, isAdmin }) => {
                  if (e) {
                    if (e.type === "NOT_ENROLLED") setIsEnrolled(false);
                    else setError(e);
                  } else {
                    setMessages(m);
                    if (isAdmin) setIsAdminUser(true);
                    setHasMore(m.length === 50);
                  }
                  setLoadingInitial(false);
                });
              }}
              className="text-[11px] font-bold text-brand-heading hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <ChatHeader messageCount={messages.length} />

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0"
      >
        {/* Infinite scroll sentinel (top) */}
        <div ref={topSentinelRef} className="h-px" />

        {/* Loading older indicator */}
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Loader2 size={12} className="animate-spin" />
              Loading older messages
            </div>
          </div>
        )}

        {/* Load more button (fallback for when IntersectionObserver doesn't trigger) */}
        {hasMore && !loadingOlder && messages.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={() => {
                const oldest = messages[0]?.created_at;
                if (!oldest || !accessToken) return;
                setLoadingOlder(true);
                preserveScrollPositionFor(async () => {
                  const { messages: older, error: olderError } =
                    await fetchOlderMessages(courseId, accessToken, oldest);
                  if (!olderError && older.length > 0) {
                    setMessages((prev) => [...older, ...prev]);
                    setHasMore(older.length === 50);
                  } else {
                    setHasMore(false);
                  }
                  setLoadingOlder(false);
                });
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-brand-heading transition-colors py-1"
            >
              <ChevronUp size={12} />
              Load older messages
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !loadingInitial && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-brand-heading">
              <MessageSquare size={22} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
              No Messages Yet
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-[180px]">
              Be the first to start a conversation with your cohort.
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.user_id === userId}
            isAdmin={isAdminUser}
            onDelete={handleDeleteMessage}
          />
        ))}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Send error */}
      {sendError && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-100 bg-white p-4 pb-8">
        <div className="flex items-center gap-3">
          <div className="shrink-0 h-12 flex items-center">
            <UserAvatar name={userName} size={32} textSize="text-xs" />
          </div>

          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setSendError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Write a message… (Enter to send)"
              rows={1}
              maxLength={2000}
              disabled={isPending}
              className="
                block w-full resize-none rounded-xl border border-gray-200 bg-gray-50
                px-4 py-3 text-base text-gray-800 placeholder-gray-400
                leading-relaxed
                focus:outline-none focus:border-brand-heading focus:bg-white
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                max-h-32 overflow-y-auto
              "
              style={{ minHeight: "48px" }}
              onInput={(e) => {
                // Auto-resize textarea
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />
            {inputValue.length > 1800 && (
              <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 bg-white/80 px-1 rounded">
                {2000 - inputValue.length}
              </span>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isPending}
            className="
              shrink-0 rounded-xl px-4 h-12
              bg-brand-heading hover:bg-brand-heading-hover
              text-white disabled:opacity-40
              transition-all
            "
            aria-label="Send message"
          >
            {isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat header ──────────────────────────────────────────────────────────────

function ChatHeader({ messageCount }: { messageCount?: number }) {
  return (
    <div className="shrink-0 p-4 border-b border-gray-50 bg-gray-50/10 text-left">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-2">
        <MessageSquare size={12} />
        Community
      </h3>
      <p className="text-[11px] text-gray-400">
        {messageCount !== undefined && messageCount > 0
          ? `${messageCount} message${messageCount === 1 ? "" : "s"} — ask questions, share insights, connect with peers.`
          : "Ask questions, share insights, and connect with your peers."}
      </p>
    </div>
  );
}

