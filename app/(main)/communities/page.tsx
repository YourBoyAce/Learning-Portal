"use client";

import { useEffect, useState } from "react";
import UserCommunitySidebar, { CommunityCourse } from "./UserCommunitySidebar";
import CommunityChatPanel from "../courses/[id]/components/CommunityChatPanel";

export default function UserCommunitiesPage() {
    const [selectedCourse, setSelectedCourse] = useState<CommunityCourse | null>(null);

    return (
        <div className="p-4 h-full">
            <div className="flex h-full bg-white rounded-2xl overflow-hidden border">
                {/* LEFT SIDEBAR */}
                <div className="w-[340px] border-r bg-[#fafafa]">
                    <UserCommunitySidebar
                        selectedCourse={selectedCourse}
                        onSelectCourse={setSelectedCourse}
                    />
                </div>

                {/* RIGHT CHAT */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {selectedCourse ? (
                        <div className="absolute inset-0 flex flex-col">
                            <CommunityChatPanel 
                                key={selectedCourse.id}
                                courseId={selectedCourse.id}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-1 items-center justify-center bg-[#fcfcfc]">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <h2 className="text-2xl font-bold text-brand-heading">
                                    Your Communities
                                </h2>
                                <p className="text-gray-500 mt-2">
                                    Select a course from the left to join the conversation.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
