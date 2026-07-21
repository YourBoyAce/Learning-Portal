'use client';

import { useState } from 'react';
import CommunitySidebar from '../communities/CommunitySidebar';
import CommunityChat from '../communities/CommunityChat';

export interface CommunityCourse {
    id: string;
    title: string;
    slug: string;
    unread?: number;
}

export default function CommunitiesPage() {
    const [selectedCourse, setSelectedCourse] =
        useState<CommunityCourse | null>(null);

    return (
        <div className="flex h-full bg-white rounded-2xl overflow-hidden border">

            {/* LEFT SIDEBAR */}

            <div className="w-[340px] border-r bg-[#fafafa]">
                <CommunitySidebar
                    selectedCourse={selectedCourse}
                    onSelectCourse={setSelectedCourse}
                />
            </div>

            {/* RIGHT CHAT */}

            <div className="flex-1 flex flex-col">

                {selectedCourse ? (
                    <CommunityChat course={selectedCourse} />
                ) : (
                    <div className="flex flex-1 items-center justify-center bg-[#fcfcfc]">

                        <div className="text-center">

                            <div className="text-6xl mb-4">💬</div>

                            <h2 className="text-2xl font-bold text-brand-heading">
                                Course Communities
                            </h2>

                            <p className="text-gray-500 mt-2">
                                Select a course from the left to manage its community.
                            </p>

                        </div>

                    </div>
                )}

            </div>

        </div>
    );
}