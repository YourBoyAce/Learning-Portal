"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, MessageCircle } from "lucide-react";
import { CommunityCourse } from "./page";
import { supabase } from "@/app/lib/supabase";

interface SidebarCourse extends CommunityCourse {
    heroImage?: string;
    lastMessage?: string;
    lastActivity?: string;
}

interface Props {
    selectedCourse: CommunityCourse | null;
    onSelectCourse: (course: CommunityCourse) => void;
}

export default function CommunitySidebar({
    selectedCourse,
    onSelectCourse,
}: Props) {
    const [courses, setCourses] = useState<SidebarCourse[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        async function loadCourses() {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData.session?.access_token) return;

                const response = await fetch("/api/admin/courses", {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Authorization: `Bearer ${sessionData.session.access_token}`,
                    },
                });

                const result = await response.json();
                if (response.ok && Array.isArray(result?.courses)) {
                    // Filter out upcoming courses
                    const activeCourses = result.courses.filter((c: any) => c.course_type !== "upcoming");

                    const formatted: SidebarCourse[] = await Promise.all(activeCourses.map(async (course: any) => {
                        // Fetch latest message for this course
                        const { data } = await supabase
                            .from("course_messages")
                            .select("content, created_at")
                            .eq("course_id", course.id)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        return {
                            id: course.id.toString(),
                            slug: course.id.toString(),
                            title: course.title,
                            heroImage: course.thumbnail_url,
                            unread: 0,
                            lastMessage: data?.content || "No messages yet",
                            lastActivity: data?.created_at ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(data.created_at)) : "",
                        };
                    }));

                    setCourses(formatted);

                    if (formatted.length > 0 && !selectedCourse) {
                        onSelectCourse(formatted[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch courses:", error);
            }
        }

        loadCourses();
    }, []);

    const filtered = courses.filter((course) =>
        course.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-full flex-col bg-white">

            {/* Header */}

            <div className="border-b px-5 py-5">

                <h2 className="text-lg font-bold text-brand-heading">
                    Communities
                </h2>

                <p className="text-sm text-gray-500">
                    Manage all course discussions
                </p>

                {/* Search */}

                <div className="relative mt-4">

                    <Search
                        size={18}
                        className="absolute left-3 top-3 text-gray-400"
                    />

                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search courses..."
                        className="
              w-full
              rounded-xl
              border
              border-gray-200
              bg-gray-50
              py-2.5
              pl-10
              pr-4
              text-sm
              outline-none
              focus:border-brand-heading
            "
                    />

                </div>

            </div>

            {/* Course List */}

            <div className="flex-1 overflow-y-auto">

                {filtered.map((course) => {

                    const active = selectedCourse?.id === course.id;

                    return (
                        <button
                            key={course.id}
                            onClick={() => onSelectCourse(course)}
                            className={`
                flex
                w-full
                items-center
                gap-4
                border-b
                px-5
                py-4
                transition-all

                ${active
                                    ? "bg-brand-heading text-white"
                                    : "hover:bg-gray-50"
                                }
              `}
                        >

                            {/* Course Image */}

                            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-gray-100">

                                {course.heroImage ? (
                                    <Image
                                        src={course.heroImage}
                                        fill
                                        alt={course.title}
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center">

                                        <MessageCircle
                                            size={20}
                                            className={
                                                active
                                                    ? "text-white"
                                                    : "text-brand-heading"
                                            }
                                        />

                                    </div>
                                )}

                            </div>

                            {/* Course Details */}

                            <div className="flex flex-1 flex-col items-start overflow-hidden">

                                <span
                                    className={`
                    truncate
                    font-semibold

                    ${active
                                            ? "text-white"
                                            : "text-brand-heading"
                                        }
                  `}
                                >
                                    {course.title}
                                </span>

                                <span
                                    className={`
                    mt-1
                    truncate
                    text-xs

                    ${active
                                            ? "text-white/80"
                                            : "text-gray-500"
                                        }
                  `}
                                >
                                    {course.lastMessage}
                                </span>

                            </div>

                            {/* Right */}

                            <div className="flex flex-col items-end gap-2">

                                <span
                                    className={`
                    text-[11px]

                    ${active
                                            ? "text-white/80"
                                            : "text-gray-400"
                                        }
                  `}
                                >
                                    {course.lastActivity}
                                </span>

                                {(course.unread ?? 0) > 0 && (
                                    <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {course.unread}
                                    </div>
                                )}

                            </div>

                        </button>
                    );
                })}

            </div>

        </div>
    );
}