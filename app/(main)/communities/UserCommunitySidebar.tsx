"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";
import { getUserCommunities } from "@/app/actions/community-chat";

export interface CommunityCourse {
    id: string;
    title: string;
    slug: string;
    unread?: number;
    heroImage?: string;
}

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

export default function UserCommunitySidebar({
    selectedCourse,
    onSelectCourse,
}: Props) {
    const [courses, setCourses] = useState<SidebarCourse[]>([]);
    const [search, setSearch] = useState("");
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        async function loadCourses() {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData.session?.user?.id) return;
                
                const currentUserId = sessionData.session.user.id;
                setUserId(currentUserId);

                const { courses: userCourses, error } = await getUserCommunities(sessionData.session.access_token);

                if (!error && Array.isArray(userCourses)) {
                    // Fetch read timestamps for the current user
                    const { data: readData } = await supabase
                        .from("community_reads")
                        .select("course_id, last_read_at")
                        .eq("user_id", currentUserId);
                        
                    const readMap = new Map(readData?.map(r => [r.course_id, r.last_read_at]) || []);

                    const formatted: SidebarCourse[] = await Promise.all(userCourses.map(async (course: any) => {
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
                        if (currentUserId) {
                            supabase.from('community_reads').upsert({
                                user_id: currentUserId,
                                course_id: firstCourse.id,
                                last_read_at: new Date().toISOString()
                            }).then();
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load community courses:", err);
            }
        }

        loadCourses();
    }, []);

    // ─── Realtime Subscriptions ──────────────────────────────────────────────
    useEffect(() => {
        if (!userId || courses.length === 0) return;

        const channel = supabase.channel('global-course-messages-user')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'course_messages'
                },
                (payload) => {
                    const newMsg = payload.new;
                    
                    setCourses(prevCourses => {
                        const courseIndex = prevCourses.findIndex(c => c.id === newMsg.course_id);
                        if (courseIndex === -1) return prevCourses;

                        const course = { ...prevCourses[courseIndex] };
                        
                        course.lastMessage = newMsg.content;
                        course.lastActivityRaw = newMsg.created_at;
                        course.lastActivity = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(newMsg.created_at));

                        if (selectedCourse?.id !== course.id) {
                            course.unread = (course.unread || 0) + 1;
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
                    Connect with your peers
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
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-heading"
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
                            onClick={() => {
                                onSelectCourse(course);
                                if (userId) {
                                    setCourses(prev => prev.map(c => 
                                        c.id === course.id ? { ...c, unread: 0 } : c
                                    ));
                                }
                            }}
                            className={`flex w-full items-center gap-4 border-b px-5 py-4 transition-all ${
                                active ? "bg-blue-500 text-white" : "hover:bg-gray-50"
                            }`}
                        >
                            {/* Course Image */}
                            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-gray-100 shrink-0">
                                <Image
                                    src={course.heroImage || PLACEHOLDER_IMAGE}
                                    fill
                                    alt={course.title}
                                    className="object-cover"
                                />
                            </div>

                            {/* Course Details */}
                            <div className="flex flex-1 flex-col items-start overflow-hidden">
                                <span className={`truncate font-semibold ${
                                    active ? "text-white" : "text-brand-heading"
                                }`}>
                                    {course.title}
                                </span>

                                <span className={`mt-1 truncate text-xs ${
                                    active ? "text-white/80" : "text-gray-500"
                                }`}>
                                    {course.lastMessage}
                                </span>
                            </div>

                            {/* Right side: Time and Unread Badge */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-[10px] font-medium ${
                                    active ? "text-white/80" : "text-gray-400"
                                }`}>
                                    {course.lastActivity}
                                </span>
                                
                                {course.unread && course.unread > 0 ? (
                                    <div className="flex h-5 items-center justify-center rounded-full bg-brand-alt px-2 text-[10px] font-bold text-white min-w-[20px]">
                                        {course.unread > 4 ? "4+" : course.unread}
                                    </div>
                                ) : null}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
