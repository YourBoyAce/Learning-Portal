"use client";

import {
    useEffect,
    useState,
    useRef,
    useTransition,
    useCallback,
} from "react";

import { Loader2, AlertCircle } from "lucide-react";

import { supabase } from "@/app/lib/supabase";

import CommunityHeader from "./CommunityHeader";
import MessageBubble, { ChatMessage } from "./MessageBubble";
import MessageInput from "./MessageInput";
import CommunityChatSkeleton from "@/app/components/chat/CommunityChatSkeleton";

import { CommunityCourse } from "./page";

import {
    fetchInitialMessages,
    fetchOlderMessages,
    sendCourseMessage,
    deleteCourseMessage,
    type FetchMessagesError,
} from "@/app/actions/community-chat";

interface CommunityChatProps {
    course: CommunityCourse;
}

export default function CommunityChat({
    course,
}: CommunityChatProps) {
    /*************************************************
     *
     * STATES
     *
     *************************************************/

    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [loadingInitial, setLoadingInitial] = useState(true);

    const [loadingOlder, setLoadingOlder] = useState(false);

    const [hasMore, setHasMore] = useState(false);

    const [error, setError] =
        useState<FetchMessagesError | null>(null);

    const [isPending, startTransition] = useTransition();

    const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
    const [currentAdminName, setCurrentAdminName] = useState<string>("Administrator");
    const [currentAccessToken, setCurrentAccessToken] = useState<string | null>(null);
    const [lastReadAt, setLastReadAt] = useState<string | null>(null);

    /*************************************************
     *
     * REFS
     *
     *************************************************/

    const scrollContainerRef =
        useRef<HTMLDivElement>(null);

    const messagesEndRef =
        useRef<HTMLDivElement>(null);

    const topSentinelRef =
        useRef<HTMLDivElement>(null);

    const channelRef =
        useRef<ReturnType<typeof supabase.channel> | null>(
            null
        );

    const initialScrollDone =
        useRef(false);

    /*************************************************
     *
     * SCROLL HELPERS
     *
     *************************************************/

    const scrollToBottom = useCallback(
        (
            behavior: ScrollBehavior = "smooth"
        ) => {
            messagesEndRef.current?.scrollIntoView({
                behavior,
                block: "end",
            });
        },
        []
    );

    /*
        Stable callback reference
  
        Used inside realtime subscription
        without causing unnecessary re-renders.
    */

    const scrollToBottomRef =
        useRef(scrollToBottom);

    useEffect(() => {
        scrollToBottomRef.current =
            scrollToBottom;
    }, [scrollToBottom]);

    /*
        Keeps user's scroll position while
        loading older messages.
    */

    const preserveScrollPosition =
        useCallback(
            async (
                action: () => Promise<void>
            ) => {
                const container =
                    scrollContainerRef.current;

                if (!container) {
                    await action();
                    return;
                }

                const previousHeight =
                    container.scrollHeight;

                await action();

                requestAnimationFrame(() => {
                    container.scrollTop =
                        container.scrollHeight -
                        previousHeight +
                        container.scrollTop;
                });
            },
            []
        );

    /*************************************************
     *
     * INITIAL LOAD
     *
     *************************************************/

    useEffect(() => {
        let mounted = true;

        async function loadMessages() {
            setLoadingInitial(true);

            let adminId = currentAdminId;
            let adminName = currentAdminName;
            let token = currentAccessToken;

            if (!adminId || !token) {
                const { data: sessionData } = await supabase.auth.getSession();
                adminId = sessionData.session?.user?.id || null;
                token = sessionData.session?.access_token || null;
                if (adminId && token) {
                    setCurrentAdminId(adminId);
                    setCurrentAccessToken(token);
                    // Optionally fetch profile here or use metadata
                    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", adminId).single();
                    adminName = profile?.full_name || "Administrator";
                    setCurrentAdminName(adminName);
                }
            }

            if (!adminId || !token) {
                setError({ type: "ERROR", message: "Not authenticated" });
                setLoadingInitial(false);
                return;
            }

            const { data: readData } = await supabase
                .from("community_reads")
                .select("last_read_at")
                .eq("user_id", adminId)
                .eq("course_id", course.id)
                .maybeSingle();

            if (mounted && readData?.last_read_at) {
                setLastReadAt(readData.last_read_at);
            }

            supabase.from("community_reads").upsert({
                user_id: adminId,
                course_id: course.id,
                last_read_at: new Date().toISOString()
            }).then();

            const {
                messages: initialMessages,
                error: fetchError,
            } = await fetchInitialMessages(
                course.id,
                token
            );

            if (!mounted) return;

            if (fetchError) {
                setError(fetchError);
                setLoadingInitial(false);
                return;
            }

            setMessages(initialMessages);

            setHasMore(
                initialMessages.length === 50
            );

            setLoadingInitial(false);
        }

        loadMessages();

        return () => {
            mounted = false;
        };
    }, [course.id]);

    /*
        Scroll to bottom after first load
    */

    useEffect(() => {
        if (
            !loadingInitial &&
            !initialScrollDone.current
        ) {
            initialScrollDone.current = true;

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

            scrollToBottom(
                "instant" as ScrollBehavior
            );
        }
    }, [
        loadingInitial,
        messages,
        lastReadAt,
        scrollToBottom,
    ]);

    /*************************************************
     *
     * PROFILE CACHE
     * Avoids a DB round-trip per realtime message.
     * Seeded from already-loaded messages on mount;
     * grows as new senders appear.
     *
     *************************************************/

    const profileCacheRef = useRef<Map<string, { full_name: string | null; role: string | null }>>(new Map());

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

    /*************************************************
   *
   * REALTIME SUBSCRIPTION
   *
   *************************************************/

    useEffect(() => {
        const channelId = `admin-community-${course.id}-${Math.random()
            .toString(36)
            .slice(2)}`;

        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "course_messages",
                    filter: `course_id=eq.${course.id}`,
                },
                (payload) => {
                    const newRow = payload.new as {
                        id: string;
                        course_id: string;
                        user_id: string;
                        content: string;
                        created_at: string;
                    };

                    const applyMessage = (cachedProfile: { full_name: string | null; role: string | null } | null) => {
                        const incomingMessage: ChatMessage = {
                            id: newRow.id,
                            course_id: newRow.course_id,
                            user_id: newRow.user_id,
                            content: newRow.content,
                            created_at: newRow.created_at,
                            full_name: cachedProfile?.full_name ?? null,
                            role: cachedProfile?.role ?? null,
                        };

                        setMessages((current) => {
                            if (current.some((m) => m.id === incomingMessage.id)) {
                                return current;
                            }
                            return [...current, incomingMessage];
                        });

                        // Auto-scroll only if user is already near bottom
                        const container = scrollContainerRef.current;
                        if (!container) return;
                        const distanceFromBottom =
                            container.scrollHeight -
                            container.scrollTop -
                            container.clientHeight;
                        if (distanceFromBottom < 120) {
                            setTimeout(() => { scrollToBottomRef.current(); }, 80);
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
                                const profile = {
                                    full_name: data?.full_name ?? null,
                                    role: data?.role ?? null,
                                };
                                profileCacheRef.current.set(newRow.user_id, profile);
                                applyMessage(profile);
                            });
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [course.id]);

    /*************************************************
     *
     * LOAD OLDER MESSAGES
     *
     *************************************************/

    useEffect(() => {
        if (!hasMore) return;

        const sentinel =
            topSentinelRef.current;

        if (!sentinel) return;

        const observer =
            new IntersectionObserver(
                (entries) => {
                    if (
                        entries[0].isIntersecting &&
                        hasMore &&
                        !loadingOlder
                    ) {
                        const oldest =
                            messages[0]?.created_at;

                        if (!oldest) return;

                        setLoadingOlder(true);

                        preserveScrollPosition(
                            async () => {
                                        if (!currentAdminId) return;
                                        const {
                                            messages: olderMessages,
                                            error,
                                        } =
                                            await fetchOlderMessages(
                                                course.id,
                                                currentAdminId,
                                                oldest
                                            );

                                if (
                                    !error &&
                                    olderMessages.length > 0
                                ) {
                                    setMessages(
                                        (previousMessages) => {
                                            const ids =
                                                new Set(
                                                    previousMessages.map(
                                                        (m) => m.id
                                                    )
                                                );

                                            const uniqueOlder =
                                                olderMessages.filter(
                                                    (m) =>
                                                        !ids.has(m.id)
                                                );

                                            return [
                                                ...uniqueOlder,
                                                ...previousMessages,
                                            ];
                                        }
                                    );

                                    setHasMore(
                                        olderMessages.length === 50
                                    );
                                } else {
                                    setHasMore(false);
                                }

                                setLoadingOlder(false);
                            }
                        );
                    }
                },
                {
                    root: scrollContainerRef.current,
                    threshold: 0.1,
                }
            );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [
        messages,
        hasMore,
        loadingOlder,
        preserveScrollPosition,
        course.id,
    ]);

    /*************************************************
   *
   * SEND MESSAGE
   *
   *************************************************/

    const handleSendMessage = useCallback(
        async (content: string) => {
            if (!currentAdminId || !currentAdminName || !currentAccessToken) return;

            const trimmed = content.trim();
            if (!trimmed) return;

            const tempId = `temp-${Date.now()}`;
            const optimisticMessage: ChatMessage = {
                id: tempId,
                course_id: course.id,
                user_id: currentAdminId,
                content: trimmed,
                created_at: new Date().toISOString(),
                full_name: currentAdminName,
                role: "admin",
            };

            setMessages((prev) => [...prev, optimisticMessage]);

            setTimeout(() => {
                scrollToBottom("smooth");
            }, 50);

            startTransition(async () => {
                const { message: confirmedMessage, error: sendError } = await sendCourseMessage(
                    currentAccessToken,
                    course.id,
                    trimmed
                );

                if (sendError) {
                    /*
                      Remove optimistic message
                    */

                    setMessages((previous) =>
                        previous.filter(
                            (m) => m.id !== tempId
                        )
                    );

                    console.error(sendError);

                    return;
                }

                /*
                  Replace optimistic message
                */

                if (confirmedMessage) {
                    setMessages((previous) =>
                        previous.map((message) =>
                            message.id === tempId
                                ? confirmedMessage
                                : message
                        )
                    );
                }
            });
        },
        [
            course.id,
            currentAdminId,
            currentAdminName,
            currentAccessToken,
            scrollToBottom,
        ]
    );

    /*************************************************
     *
     * DELETE MESSAGE
     *
     *************************************************/

    const handleDeleteMessage = useCallback(
        async (msgId: string) => {
            if (!currentAccessToken) return;
            const { success, error } =
                await deleteCourseMessage(
                    currentAccessToken,
                    msgId
                );

            if (!success) {
                console.error(error);

                return;
            }

            setMessages((previous) =>
                previous.filter(
                    (message) => message.id !== msgId
                )
            );
        },
        [currentAccessToken]
    );

    /*************************************************
     *
     * REFRESH CHAT
     *
     *************************************************/

    const refreshMessages = useCallback(async () => {
        if (!currentAccessToken) return;
        setLoadingInitial(true);

        const {
            messages: latestMessages,
            error: fetchError,
        } = await fetchInitialMessages(
            course.id,
            currentAccessToken
        );

        if (fetchError) {
            setError(fetchError);

            setLoadingInitial(false);

            return;
        }

        setMessages(latestMessages);

        setHasMore(latestMessages.length === 50);

        setLoadingInitial(false);

        requestAnimationFrame(() => {
            scrollToBottom("instant" as ScrollBehavior);
        });
    }, [
        course.id,
        currentAdminId,
        scrollToBottom,
    ]);

    /*************************************************
     *
     * LOADING SCREEN
     *
     *************************************************/

    if (loadingInitial) {
        return (
            <div className="flex h-full flex-1 flex-col bg-white">
                <CommunityHeader
                    courseTitle={course.title}
                    messageCount={0}
                />
                <CommunityChatSkeleton />
            </div>
        );
    }

    /*************************************************
     *
     * ERROR SCREEN
     *
     *************************************************/

    if (error) {
        return (
            <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-white">

                <AlertCircle
                    size={40}
                    className="text-red-500"
                />

                <h2 className="text-lg font-bold">
                    Unable to load messages
                </h2>

                <p className="max-w-sm text-center text-sm text-gray-500">
                    {error.message}
                </p>

                <button
                    onClick={refreshMessages}
                    className="
            rounded-lg
            bg-brand-heading
            px-5
            py-2
            text-white
            hover:bg-brand-heading-hover
          "
                >
                    Retry
                </button>

            </div>
        );
    }

    /*************************************************
   *
   * MAIN UI
   *
   *************************************************/

    return (
        <div className="flex h-full flex-col bg-white">

            {/* Header */}

            <CommunityHeader
                courseTitle={course.title}
                messageCount={messages.length}
            />

            {/* Messages */}

            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6"
            >
                {/* Infinite scroll sentinel */}

                <div ref={topSentinelRef} />

                {/* Loading older */}

                {loadingOlder && (
                    <div className="flex justify-center py-3">

                        <Loader2
                            size={18}
                            className="animate-spin text-brand-heading"
                        />

                    </div>
                )}

                {/* Load older button */}

                {hasMore && !loadingOlder && (
                    <div className="mb-5 flex justify-center">

                        <button
                            onClick={async () => {
                                const oldest =
                                    messages[0]?.created_at;

                                if (!oldest) return;

                                setLoadingOlder(true);

                                preserveScrollPosition(async () => {
                                    if (!currentAdminId) return;

                                    const {
                                        messages: older,
                                        error,
                                    } =
                                        await fetchOlderMessages(
                                            course.id,
                                            currentAdminId,
                                            oldest
                                        );

                                    if (!error) {
                                        setMessages((previous) => {
                                            const ids = new Set(
                                                previous.map((m) => m.id)
                                            );

                                            const uniqueOlder =
                                                older.filter(
                                                    (m) =>
                                                        !ids.has(m.id)
                                                );

                                            return [
                                                ...uniqueOlder,
                                                ...previous,
                                            ];
                                        });

                                        setHasMore(
                                            older.length === 50
                                        );
                                    } else {
                                        setHasMore(false);
                                    }

                                    setLoadingOlder(false);
                                });
                            }}
                            className="
                rounded-lg
                border
                border-gray-200
                bg-white
                px-4
                py-2
                text-xs
                font-semibold
                text-gray-500
                transition
                hover:border-brand-heading
                hover:text-brand-heading
              "
                        >
                            Load older messages
                        </button>

                    </div>
                )}

                {/* Empty state */}

                {messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center">

                        <div className="rounded-full bg-blue-100 p-5">

                            <AlertCircle
                                size={28}
                                className="text-brand-heading"
                            />

                        </div>

                        <h2 className="mt-6 text-xl font-bold text-brand-heading">
                            No Messages Yet
                        </h2>

                        <p className="mt-2 max-w-sm text-center text-gray-500">
                            This course community hasn't started
                            chatting yet.
                        </p>

                    </div>
                )}

                {/* Messages */}

                <div className="space-y-5">

                    {messages.map((message) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            currentUserId={currentAdminId || ""}
                            isAdmin={true}
                            onDelete={handleDeleteMessage}
                        />
                    ))}

                </div>

                {/* Scroll anchor */}

                <div
                    ref={messagesEndRef}
                    className="h-2"
                />

            </div>

            {/* Bottom Input */}

            <div className="border-t border-gray-200 bg-white p-5">

                <MessageInput
                    currentUserName={currentAdminName}
                    onSend={handleSendMessage}
                />

            </div>

        </div>
    );
}