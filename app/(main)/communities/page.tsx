"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import UserCommunitySidebar, { CommunityCourse } from "./UserCommunitySidebar";
import CommunityChatPanel from "../courses/[id]/components/CommunityChatPanel";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";
import { ArrowLeft } from "lucide-react";

export default function UserCommunitiesPage() {
    const searchParams = useSearchParams();
    const initialCourseId = searchParams.get("course");
    const [selectedCourse, setSelectedCourse] = useState<CommunityCourse | null>(null);
    const { isLoading: isTierLoading, canAccess } = useSecurityGatedData();

    return (
        <div className="p-0 md:p-4 h-full">
            <div className="flex h-full md:bg-white md:rounded-2xl overflow-hidden md:border">
                {/* LEFT SIDEBAR */}
                <div className={`w-full md:w-[340px] border-r bg-[#fafafa] flex-shrink-0 ${selectedCourse ? 'hidden md:block' : 'block'}`}>
                    <UserCommunitySidebar
                        selectedCourse={selectedCourse}
                        onSelectCourse={setSelectedCourse}
                        initialCourseId={initialCourseId}
                    />
                </div>

                {/* RIGHT CHAT */}
                <div className={`flex-1 flex-col relative overflow-hidden bg-white ${selectedCourse ? 'flex' : 'hidden md:flex'}`}>
                    {!isTierLoading && !canAccess("Chat") ? (
                        <div className="flex flex-1 items-center justify-center p-6 bg-[#fcfcfc]">
                            <UpgradeRequired
                                title="Community Chat Gated"
                                description="Accessing batch student communities requires an active plan subscription. Upgrade today to join discussions with peers and mentors."
                                requiredTier="Starter"
                            />
                        </div>
                    ) : selectedCourse ? (
                        <div className="absolute inset-0 flex flex-col">
                            <CommunityChatPanel 
                                key={selectedCourse.id}
                                courseId={selectedCourse.id}
                                onBack={() => setSelectedCourse(null)}
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
