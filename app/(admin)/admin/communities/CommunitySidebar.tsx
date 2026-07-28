"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { CommunityCourse } from "./page";
import { supabase } from "@/app/lib/supabase";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";

interface SidebarCourse extends CommunityCourse {
    heroImage?: string;
    lastMessage?: string;
    lastActivityRaw?: string | null;
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
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        async function loadCourses() {
            setIsLoading(true);
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData.session?.access_token) return;
                
                setUserId(sessionData.session.user.id);

                const response = await fetch("/api/admin/courses", {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Authorization: `Bearer ${sessionData.session.access_token}`,
                    },
                });

                const result = await response.json();
                if (response.ok && Array.isArray(result?.courses)) {
                    const activeCourses = result.courses.filter((c: any) => c.course_type !== "upcoming");

                    // Fetch read timestamps for the current user
                    const { data: readData } = await supabase
                        .from("community_reads")
                        .select("course_id, last_read_at")
                        .eq("user_id", sessionData.session.user.id);
                        
                    const readMap = new Map(readData?.map(r => [r.course_id, r.last_read_at]) || []);

                    const formatted: SidebarCourse[] = await Promise.all(activeCourses.map(async (course: any) => {
                        const { data } = await supabase
                            .from("course_messages")
                            .select("content, created_at")
                            .eq("course_id", course.id)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        const lastReadAt = readMap.get(course.id.toString()) || '1970-01-01T00:00:00.000Z';
                        
                        const { count } = await supabase
                            .from("course_messages")
                            .select("*", { count: "exact", head: true })
                            .eq("course_id", course.id)
                            .gt("created_at", lastReadAt);

                        return {
                            id: course.id.toString(),
                            slug: course.id.toString(),
                            title: course.title,
                            heroImage: course.thumbnail_url,
                            unread: count || 0,
                            lastMessage: data?.content || "No messages yet",
                            lastActivityRaw: data?.created_at || null,
                            lastActivity: data?.created_at ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(data.created_at)) : "",
                        };
                    }));

                    // Sort so most recent activity is at the top
                    formatted.sort((a, b) => {
                        const dateA = a.lastActivityRaw ? new Date(a.lastActivityRaw).getTime() : 0;
                        const dateB = b.lastActivityRaw ? new Date(b.lastActivityRaw).getTime() : 0;
                        return dateB - dateA;
                    });

                    setCourses(formatted);

                    if (formatted.length > 0 && !selectedCourse) {
                        const firstCourse = formatted[0];
                        onSelectCourse(firstCourse);
                        if (sessionData.session.user.id) {
                            supabase.from('community_reads').upsert({
                                user_id: sessionData.session.user.id,
                                course_id: firstCourse.id,
                                last_read_at: new Date().toISOString()
                            }).then();
                            firstCourse.unread = 0;
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load admin community courses:", err);
            } finally {
                setIsLoading(false);
            }
        }

        loadCourses();
    }, []);

    // Global realtime subscription for reordering & unread logic
    useEffect(() => {
        if (!userId || courses.length === 0) return;

        const channel = supabase.channel('global-course-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'course_messages',
                },
                (payload) => {
                    const newMessage = payload.new;
                    const courseId = newMessage.course_id;

                    setCourses((prevCourses) => {
                        const courseIndex = prevCourses.findIndex(c => c.id === courseId);
                        if (courseIndex === -1) return prevCourses;

                        const course = { ...prevCourses[courseIndex] };
                        course.lastMessage = newMessage.content;
                        course.lastActivityRaw = newMessage.created_at;
                        course.lastActivity = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(newMessage.created_at));
                        
                        // Increment unread if we are not currently viewing it
                        if (selectedCourse?.id !== courseId) {
                            course.unread = (course.unread || 0) + 1;
                        } else {
                            supabase.from('community_reads').upsert({
                                user_id: userId,
                                course_id: courseId,
                                last_read_at: new Date().toISOString()
                            }).then();
                        }

                        // Remove old course and push updated one to top
                        const newCourses = [...prevCourses];
                        newCourses.splice(courseIndex, 1);
                        newCourses.unshift(course);

                        return newCourses;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, courses.length > 0, selectedCourse?.id]);

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
                {isLoading ? (
                    // Skeleton Loaders
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={`skel-${i}`} className="flex w-full items-center gap-4 border-b px-5 py-4">
                            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-gray-100 shrink-0 animate-pulse" />
                            <div className="flex flex-1 flex-col items-start overflow-hidden gap-2">
                                <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
                                <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                            </div>
                        </div>
                    ))
                ) : (
                    filtered.map((course) => {

                    const active = selectedCourse?.id === course.id;

                    return (
                        <button
                            key={course.id}
                            onClick={() => {
                                onSelectCourse(course);
                                if (userId) {
                                    setCourses(prev => prev.map(c => 
                                        c.id === course.id ? { ...c, unread: 0 } : c
                                    ));
                                }
                            }}
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
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-gray-50"
                                }
              `}
                        >

                            {/* Course Image */}

                            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-gray-100">

                                <Image
                                    src={course.heroImage || PLACEHOLDER_IMAGE}
                                    fill
                                    alt={course.title}
                                    className="object-cover"
                                />

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
                                    <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                        {(course.unread ?? 0) > 4 ? "4+" : course.unread}
                                    </div>
                                )}

                            </div>

                        </button>
                    );
                }))}
            </div>
        </div>
    );
}