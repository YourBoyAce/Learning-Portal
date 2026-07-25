"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import UserAvatar from "@/app/components/UserAvatar";

export interface ChatMessage {
    id: string;
    course_id: string;
    user_id: string;
    content: string;
    created_at: string;
    full_name: string | null;
    role?: string | null;
}

interface MessageBubbleProps {
    message: ChatMessage;
    currentUserId: string;
    isAdmin?: boolean;
    onDelete: (id: string) => Promise<void>;
}

function formatTimestamp(dateString: string) {
    const date = new Date(dateString);

    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

export default function MessageBubble({
    message,
    currentUserId,
    isAdmin = false,
    onDelete,
}: MessageBubbleProps) {
    const isOwn = message.user_id === currentUserId;

    const [loading, setLoading] = useState(false);

    const displayName =
        message.full_name?.trim() ||
        `User ${message.user_id.slice(0, 6)}`;

    async function handleDelete() {
        setLoading(true);

        await onDelete(message.id);

        setLoading(false);
    }

    return (
        <div
            id={`msg-${message.id}`}
            className={`group flex gap-3 ${isOwn ? "justify-end" : "justify-start"
                }`}
        >
            {!isOwn && (
                <UserAvatar
                    name={displayName}
                    size={36}
                    textSize="text-xs"
                />
            )}

            <div
                className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"
                    } flex flex-col`}
            >
                {/* Sender */}

                <div
                    className={`mb-1 flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""
                        }`}
                >
                    <span className="text-xs font-bold text-gray-700">
                        {isOwn ? "You" : displayName}
                    </span>

                    <span className="text-[10px] text-gray-400">
                        {formatTimestamp(message.created_at)}
                    </span>

                    {isAdmin && !isOwn && (
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="opacity-0 transition group-hover:opacity-100"
                        >
                            {loading ? (
                                <Loader2
                                    size={12}
                                    className="animate-spin text-red-500"
                                />
                            ) : (
                                <Trash2
                                    size={12}
                                    className="text-red-500 hover:text-red-700"
                                />
                            )}
                        </button>
                    )}
                </div>

                {/* Bubble */}

                <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${isOwn
                            ? "rounded-tr-sm bg-brand-heading text-white"
                            : "rounded-tl-sm border border-gray-200 bg-white text-gray-700"
                        }`}
                >
                    {message.content}
                </div>
            </div>

            {isOwn && (
                <UserAvatar
                    name={displayName}
                    size={36}
                    textSize="text-xs"
                />
            )}
        </div>
    );
}