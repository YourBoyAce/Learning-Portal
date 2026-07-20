"use client";

import { MessageSquare, Users } from "lucide-react";

interface CommunityHeaderProps {
    courseTitle: string;
    messageCount?: number;
}

export default function CommunityHeader({
    courseTitle,
    messageCount = 0,
}: CommunityHeaderProps) {
    return (
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-heading/10">
                    <MessageSquare
                        size={22}
                        className="text-brand-heading"
                    />
                </div>

                <div>
                    <h2 className="text-lg font-bold text-brand-heading">
                        {courseTitle}
                    </h2>

                    <p className="text-sm text-gray-500">
                        Community Discussion
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
                <Users
                    size={16}
                    className="text-brand-heading"
                />

                <span className="text-sm font-semibold text-brand-heading">
                    {messageCount} Messages
                </span>
            </div>
        </div>
    );
}