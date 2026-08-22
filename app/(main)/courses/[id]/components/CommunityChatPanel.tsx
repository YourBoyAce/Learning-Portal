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
  getMentionablePeople,
  type ChatMessage,
  type FetchMessagesError,
  type MentionablePerson,
} from "@/app/actions/community-chat";
import { resolveMentionedUserIds } from "@/app/lib/mentions";
import UserAvatar from "@/app/components/UserAvatar";
import CommunityChatSkeleton from "@/app/components/chat/CommunityChatSkeleton";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  ChevronUp,
  Lock,
  Trash2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  AtSign,
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

// ─── Render content with @mention pills ──────────────────────────────────────

function renderContentWithMentions(
  content: string,
  mentionablePeople: MentionablePerson[] = [],
) {
  if (mentionablePeople.length === 0) return <span>{content}</span>;

  // Build an alternation regex from known full names, longest first to avoid
  // partial matches (e.g. "John" before "John Smith").
  const sorted = [...mentionablePeople].sort(
    (a, b) => b.full_name.length - a.full_name.length,
  );
  const escaped = sorted.map((p) =>
    p.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(@(?:${escaped.join("|")}))`, "g");

  const parts = content.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        if (pattern.test(part)) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary font-semibold text-[0.8em]"
            >
              <AtSign size={10} className="shrink-0" />
              {part.slice(1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Attachment preview in message bubble ────────────────────────────────────

function AttachmentDisplay({
  url,
  isOwn,
}: {
  url: string;
  isOwn: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lowerUrl = url.toLowerCase();
  const isPdf = lowerUrl.includes(".pdf") || lowerUrl.includes("application%2fpdf");
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "attachment");

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={[
          "mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold max-w-[220px] transition-colors",
          isOwn
            ? "border-brand-primary/30 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary/10"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
        ].join(" ")}
      >
        <FileText size={16} className="shrink-0" />
        <span className="truncate">{filename}</span>
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="mt-1.5 block rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Attachment"
          className="max-w-[220px] max-h-[180px] object-cover block"
          loading="lazy"
        />
      </button>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Attachment"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  isAdmin,
  onDelete,
  mentionablePeople,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  mentionablePeople: MentionablePerson[];
}) {
  const displayName =
    message.full_name?.trim() || `User ${message.user_id.slice(0, 6)}`;
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
          {/* Admin role badge */}
          {!isOwn && message.role?.toLowerCase() === "admin" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-brand-primary text-white shrink-0">
              Admin
            </span>
          )}
          {/* Mentor/Instructor role badge */}
          {!isOwn && (message.role?.toLowerCase() === "mentor" || message.role?.toLowerCase() === "instructor") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-white shrink-0">
              Mentor
            </span>
          )}
          <span className="text-[10px] text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {formatTimestamp(message.created_at)}
          </span>
          {isAdmin && !isOwn && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-1"
              title="Delete user message"
            >
              {isDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
            </button>
          )}
        </div>

        {/* Message content */}
        {message.content.trim() && (
          <div
            className={[
              "px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
              "bg-gray-100 text-gray-900 font-medium",
              isOwn ? "rounded-tr-sm" : "rounded-tl-sm",
            ].join(" ")}
          >
            {renderContentWithMentions(message.content, mentionablePeople)}
          </div>
        )}

        {/* Attachment */}
        {message.attachment_url && (
          <AttachmentDisplay url={message.attachment_url} isOwn={isOwn} />
        )}
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

// ─── Mention Dropdown ─────────────────────────────────────────────────────────

function MentionDropdown({
  people,
  query,
  onSelect,
}: {
  people: MentionablePerson[];
  query: string;
  onSelect: (person: MentionablePerson) => void;
}) {
  const filtered = people.filter((p) =>
    p.full_name.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  const getRoleColor = (role: string) => {
    if (role.toLowerCase() === "admin") return "bg-brand-primary text-white";
    return "bg-emerald-500 text-white";
  };

  const getRoleLabel = (role: string) => {
    const r = role.toLowerCase();
    if (r === "admin") return "Admin";
    if (r === "instructor") return "Instructor";
    return "Mentor";
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-150">
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <AtSign size={10} />
          Mention someone
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((person) => (
          <button
            key={person.id}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              onSelect(person);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
          >
            <UserAvatar name={person.full_name} size={28} textSize="text-[10px]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{person.full_name}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${getRoleColor(person.role)}`}>
              {getRoleLabel(person.role)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── File preview chip ────────────────────────────────────────────────────────

function FilePreviewChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 max-w-xs border border-gray-200">
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="preview"
          className="w-8 h-8 rounded-lg object-cover shrink-0"
        />
      ) : (
        <FileText size={16} className="text-gray-500 shrink-0" />
      )}
      <span className="text-xs text-gray-700 font-medium truncate flex-1 max-w-[140px]">
        {file.name}
      </span>
      <span className="text-[10px] text-gray-400 shrink-0">
        {(file.size / 1024 / 1024).toFixed(1)}MB
      </span>
      <button
        onClick={onRemove}
        className="ml-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        type="button"
      >
        <X size={14} />
      </button>
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

  // ── File attachment state ──────────────────────────────────────────────────
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── @Mention state ────────────────────────────────────────────────────────
  const [mentionablePeople, setMentionablePeople] = useState<MentionablePerson[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isInitialScrollDone = useRef(false);

  // ─── Scroll helpers ───────────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

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
          setError({ type: "ERROR", message: "User not authenticated" });
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

      supabase.from("community_reads").upsert({
        user_id: currentUserId,
        course_id: courseId,
        last_read_at: new Date().toISOString(),
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

      // Load mentionable people for @mention
      getMentionablePeople(courseId, session.access_token).then(({ people }) => {
        if (isMounted && people.length > 0) {
          setMentionablePeople(people);
        }
      });
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  // userId is derived inside this effect — including it as a dep would cause
  // a double-load on mount (first with "" then with the real id).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

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

  // ─── Profile cache: avoids a DB round-trip per realtime message ─────────────
  // Populated from already-loaded messages on mount; grows as new senders appear.
  const profileCacheRef = useRef<Map<string, { full_name: string | null; role: string | null }>>(new Map());

  // Seed the cache whenever messages change (covers initial load + older loads)
  useEffect(() => {
    for (const m of messages) {
      if (!profileCacheRef.current.has(m.user_id)) {
        profileCacheRef.current.set(m.user_id, {
          full_name: m.full_name ?? null,
          role: m.role ?? null,
        });
      }
    }
  }, [messages]);

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
            attachment_url?: string | null;
          };

          const applyMessage = (cachedProfile: { full_name: string | null; role: string | null } | null) => {
            const incomingMessage: ChatMessage = {
              id: newRow.id,
              course_id: newRow.course_id,
              user_id: newRow.user_id,
              content: newRow.content,
              created_at: newRow.created_at,
              attachment_url: newRow.attachment_url ?? null,
              full_name: cachedProfile?.full_name ?? null,
              role: cachedProfile?.role ?? null,
            };

            setMessages((current) => {
              if (current.some((m) => m.id === newRow.id)) return current;
              // Replace any matching optimistic message from this sender
              const filtered = current.filter(
                (m) =>
                  !(
                    m.id.startsWith("optimistic-") &&
                    m.content === incomingMessage.content &&
                    m.user_id === incomingMessage.user_id
                  ),
              );
              return [...filtered, incomingMessage];
            });

            const container = scrollContainerRef.current;
            if (container) {
              const distanceFromBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
              if (distanceFromBottom < 120) {
                setTimeout(() => scrollToBottomRef.current(), 50);
              }
            }
          };

          const cached = profileCacheRef.current.get(newRow.user_id);
          if (cached) {
            // Profile already known — apply immediately, no extra query
            applyMessage(cached);
          } else {
            // First time we see this sender — fetch once and cache
            supabase
              .from("profiles")
              .select("full_name, role")
              .eq("id", newRow.user_id)
              .maybeSingle()
              .then(({ data }) => {
                const profile = { full_name: data?.full_name ?? null, role: data?.role ?? null };
                profileCacheRef.current.set(newRow.user_id, profile);
                applyMessage(profile);
              });
          }
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

  // ─── @Mention detection in textarea ──────────────────────────────────────

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSendError(null);

    const cursor = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@([\w\s]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  }, []);

  const handleMentionSelect = useCallback((person: MentionablePerson) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart ?? inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursor);
    const textAfterCursor = inputValue.slice(cursor);

    const atMatch = textBeforeCursor.match(/@([\w\s]*)$/);
    if (!atMatch) return;

    const beforeAt = textBeforeCursor.slice(0, textBeforeCursor.length - atMatch[0].length);
    const newValue = `${beforeAt}@${person.full_name} ${textAfterCursor}`;
    setInputValue(newValue);
    setMentionQuery(null);

    setTimeout(() => {
      textarea.focus();
      const newPos = beforeAt.length + person.full_name.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [inputValue]);

  // ─── File upload helper ───────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `chat/${courseId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("[uploadFile] Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(data.path);

    return urlData?.publicUrl ?? null;
  }, [courseId]);

  // ─── Message send ─────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if ((!trimmed && !pendingFile) || isPending || isUploading) return;

    setSendError(null);
    setMentionQuery(null);

    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      course_id: courseId,
      user_id: userId,
      content: trimmed,
      created_at: new Date().toISOString(),
      full_name: userName || null,
      attachment_url: pendingFile ? URL.createObjectURL(pendingFile) : null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue("");
    const fileToUpload = pendingFile;
    setPendingFile(null);

    setTimeout(() => scrollToBottom(), 50);

    startTransition(async () => {
      if (!accessToken) return;

      let attachmentUrl: string | null = null;
      if (fileToUpload) {
        setIsUploading(true);
        attachmentUrl = await uploadFile(fileToUpload);
        setIsUploading(false);
        if (!attachmentUrl) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setInputValue(trimmed);
          setSendError("Failed to upload file. Please try again.");
          return;
        }
      }

      const mentionedIds = resolveMentionedUserIds(trimmed, mentionablePeople);
      const { message: confirmed, error: sendErr } = await sendCourseMessage(
        accessToken,
        courseId,
        trimmed || " ",
        attachmentUrl,
        mentionedIds,
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
  }, [inputValue, pendingFile, isPending, isUploading, courseId, userId, userName, scrollToBottom, uploadFile, accessToken, mentionablePeople]);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    if (!accessToken) return;
    const { success, error } = await deleteCourseMessage(accessToken, msgId);
    if (success) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } else {
      alert(error || "Failed to delete message.");
    }
  }, [accessToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSendError("File is too large. Maximum size is 10 MB.");
      return;
    }

    setPendingFile(file);
    e.target.value = "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        <ChatHeader />
        <CommunityChatSkeleton />
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

        {/* Load more button (fallback) */}
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
            mentionablePeople={mentionablePeople}
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
        {/* File preview chip */}
        {pendingFile && (
          <div className="mb-2">
            <FilePreviewChip
              file={pendingFile}
              onRemove={() => setPendingFile(null)}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="shrink-0 h-12 flex items-center">
            <UserAvatar name={userName} size={32} textSize="text-xs" />
          </div>

          {/* Textarea + mention dropdown wrapper */}
          <div className="flex-1 relative">
            {/* @Mention dropdown */}
            {mentionQuery !== null && mentionablePeople.length > 0 && (
              <MentionDropdown
                people={mentionablePeople}
                query={mentionQuery}
                onSelect={handleMentionSelect}
              />
            )}

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message… (@ to mention, Enter to send)"
              rows={1}
              maxLength={2000}
              disabled={isPending || isUploading}
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

          {/* Paperclip / file attach button */}
          <div className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
              id="chat-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || isUploading}
              title="Attach a file or image (max 10 MB)"
              className="
                flex items-center justify-center w-12 h-12 rounded-xl
                border border-gray-200 bg-gray-50
                text-gray-500 hover:text-brand-heading hover:border-brand-heading hover:bg-white
                transition-all disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isUploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : pendingFile ? (
                <ImageIcon size={18} className="text-brand-primary" />
              ) : (
                <Paperclip size={18} />
              )}
            </button>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={(!inputValue.trim() && !pendingFile) || isPending || isUploading}
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
