"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/app/components/UserAvatar";

interface MessageInputProps {
    currentUserName: string;
    onSend: (message: string) => Promise<void>;
}

export default function MessageInput({
    currentUserName,
    onSend,
}: MessageInputProps) {
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    async function handleSend() {
        const trimmed = message.trim();

        if (!trimmed || sending) return;

        setSending(true);

        try {
            await onSend(trimmed);
            setMessage("");
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="border-t bg-white p-4 pb-8">
            <div className="flex items-center gap-3">

                {/* Avatar */}
                <div className="shrink-0 h-12 flex items-center">
                    <UserAvatar
                        name={currentUserName}
                        size={38}
                        textSize="text-xs"
                    />
                </div>

                {/* Input */}

                <div className="relative flex-1">

                    <textarea
                        rows={1}
                        style={{ minHeight: "48px" }}
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);

                            const target = e.target;

                            target.style.height = "auto";
                            target.style.height =
                                Math.min(target.scrollHeight, 140) + "px";
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your announcement or reply..."
                        className="
              w-full
              resize-none
              rounded-2xl
              border
              border-gray-200
              bg-gray-50
              px-4
              py-3
              text-base
              text-gray-700
              placeholder:text-gray-400
              focus:border-brand-heading
              focus:bg-white
              focus:outline-none
              transition
              max-h-[140px]
              overflow-y-auto
            "
                    />

                    {/* Character counter */}

                    <span className="absolute bottom-2 right-3 text-[10px] text-gray-400">
                        {message.length}/2000
                    </span>

                </div>

                {/* Send */}

                <Button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="
            h-12
            w-12
            rounded-full
            bg-brand-heading
            hover:bg-brand-heading-hover
            p-0
          "
                >
                    {sending ? (
                        <Loader2
                            size={18}
                            className="animate-spin"
                        />
                    ) : (
                        <Send size={18} />
                    )}
                </Button>

            </div>

            <p className="mt-2 text-[11px] text-gray-400">
                Press <span className="font-semibold">Enter</span> to send ·
                <span className="font-semibold"> Shift + Enter</span> for a new line.
            </p>

        </div>
    );
}