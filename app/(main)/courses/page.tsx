// "use client";

// import { useRouter } from "next/navigation";

// export default function Courses() {
//   const router = useRouter();

//   const courses = [
//     {
//       title: "Playwright Mastery",
//       description: "End-to-end testing with Playwright — from basics to advanced CI/CD integration.",
//       lessons: 25,
//       duration: "12h 30m",
//       level: "Intermediate",
//       category: "Testing",
//       enrolled: 1420,
//       badgeColor: "badge-violet",
//     },
//     {
//       title: "Gen AI Fundamentals",
//       description: "Explore generative AI concepts, prompt engineering, and building AI-powered tools.",
//       lessons: 20,
//       duration: "10h 15m",
//       level: "Beginner",
//       category: "AI / ML",
//       enrolled: 2310,
//       badgeColor: "badge-cyan",
//     },
//     {
//       title: "Selenium Advanced",
//       description: "Advanced Selenium WebDriver techniques, Page Object Model, and framework design.",
//       lessons: 30,
//       duration: "15h 45m",
//       level: "Advanced",
//       category: "Testing",
//       enrolled: 980,
//       badgeColor: "badge-emerald",
//     },
//     {
//       title: "API Testing with Postman",
//       description: "REST & GraphQL API testing, automation with Newman, and CI/CD pipeline integration.",
//       lessons: 20,
//       duration: "8h 20m",
//       level: "Beginner",
//       category: "API",
//       enrolled: 1850,
//       badgeColor: "badge-blue",
//     },
//     {
//       title: "Performance Testing",
//       description: "Load testing with JMeter and k6 — identify bottlenecks and optimize applications.",
//       lessons: 18,
//       duration: "9h 10m",
//       level: "Intermediate",
//       category: "Performance",
//       enrolled: 720,
//       badgeColor: "badge-amber",
//     },
//     {
//       title: "Mobile Testing with Appium",
//       description: "Cross-platform mobile automation for iOS and Android using Appium framework.",
//       lessons: 22,
//       duration: "11h 00m",
//       level: "Advanced",
//       category: "Mobile",
//       enrolled: 640,
//       badgeColor: "badge-rose",
//     },
//   ];

//   return (
//     <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
//       <div style={{ maxWidth: 1200, margin: "0 auto" }}>

//         {/* Header */}
//         <div className="page-header animate-fade-in-up flex items-center gap-4">
//           <button
//             onClick={() => router.back()}
//             className="flex items-center gap-2 text-gray-600 hover:text-[#174778] transition-colors"
//           >
//             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
//             </svg>
//             <span className="text-sm font-medium">Back</span>
//           </button>
//           <div className="flex-1">
//             <h1>
//               Explore <span className="gradient-text">Courses</span>
//             </h1>
//             <p>Choose from our expert-crafted curriculum and start learning today.</p>
//           </div>
//         </div>

//         {/* Search Bar */}
//         <div className="animate-fade-in-up delay-100" style={{ marginBottom: 32 }}>
//           <div className="glass-card-static" style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
//             <span style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>🔍</span>
//             <input
//               type="text"
//               placeholder="Search courses..."
//               style={{
//                 flex: 1,
//                 background: "transparent",
//                 border: "none",
//                 outline: "none",
//                 color: "var(--text-primary)",
//                 fontSize: "0.95rem",
//               }}
//             />
//             <div style={{ display: "flex", gap: 8 }}>
//               {["All", "Testing", "AI / ML", "API"].map((filter) => (
//                 <button
//                   key={filter}
//                   className={filter === "All" ? "badge badge-violet" : "badge"}
//                   style={{
//                     cursor: "pointer",
//                     border: "none",
//                     background: filter === "All" ? undefined : "var(--surface-glass)",
//                     color: filter === "All" ? undefined : "var(--text-secondary)",
//                   }}
//                 >
//                   {filter}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Course Grid */}
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
//             gap: 24,
//           }}
//         >
//           {courses.map((course, i) => (
//             <a
//               key={course.title}
//               href={`/course-${i + 1}`}
//               style={{ textDecoration: "none" }}
//             >
//               <div
//                 className={`glass-card animate-fade-in-up delay-${Math.min((i + 1) * 100, 600)}`}
//                 style={{ padding: 0, overflow: "hidden", cursor: "pointer", height: "100%" }}
//               >
//                 {/* Thumbnail placeholder */}
//                 <div
//                   style={{
//                     height: 160,
//                     background: `linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))`,
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     position: "relative",
//                   }}
//                 >
//                   <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>▶</span>
//                   <div
//                     style={{
//                       position: "absolute",
//                       top: 12,
//                       left: 12,
//                     }}
//                   >
//                     <span className={`badge ${course.badgeColor}`}>{course.category}</span>
//                   </div>
//                   <div
//                     style={{
//                       position: "absolute",
//                       top: 12,
//                       right: 12,
//                     }}
//                   >
//                     <span className="badge" style={{ background: "rgba(0,0,0,0.5)", color: "var(--text-primary)" }}>
//                       {course.level}
//                     </span>
//                   </div>
//                 </div>

//                 {/* Content */}
//                 <div style={{ padding: "20px 24px 24px" }}>
//                   <h3
//                     style={{
//                       fontSize: "1.1rem",
//                       fontWeight: 700,
//                       color: "var(--text-primary)",
//                       marginBottom: 8,
//                     }}
//                   >
//                     {course.title}
//                   </h3>
//                   <p
//                     style={{
//                       fontSize: "0.85rem",
//                       color: "var(--text-secondary)",
//                       lineHeight: 1.6,
//                       marginBottom: 20,
//                     }}
//                   >
//                     {course.description}
//                   </p>

//                   {/* Meta */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       fontSize: "0.8rem",
//                       color: "var(--text-muted)",
//                       borderTop: "1px solid var(--border-glass)",
//                       paddingTop: 16,
//                     }}
//                   >
//                     <span>📖 {course.lessons} lessons</span>
//                     <span>⏱️ {course.duration}</span>
//                     <span>👥 {course.enrolled.toLocaleString()}</span>
//                   </div>
//                 </div>
//               </div>
//             </a>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from "@/components/ui/carousel";
import { BookOpen, PlayCircle, CheckCircle2, Calendar } from "lucide-react";

// --- Types ---
interface Insight {
  id: number;
  content: string;
  author: string;
}

interface UserStats {
  liveSessions: number;
  pendingModules: number;
}

export default function MyLearningDashboard() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Data States
  const [stats, setStats] = useState<UserStats>({ liveSessions: 0, pendingModules: 0 });
  const [weeklyProgressPct, setWeeklyProgressPct] = useState(0);

  // Insight States
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Curriculum State
  const [curriculum, setCurriculum] = useState<any[]>([
    {
      id: 1,
      title: "Full Stack Masterclass",
      description: "Continue where you left off in module 4.",
      progress: 45
    }
  ]);

  // Clean, light-themed Dummy Webinars 
  const upcomingWebinars = [
    { id: 1, title: "Future of AI in Software", date: "Nov 15, 2024 • 10:00 AM" },
    { id: 2, title: "Advanced Systems Design", date: "Nov 18, 2024 • 2:00 PM" },
    { id: 3, title: "Career Mastery Q&A", date: "Nov 22, 2024 • 1:00 PM" },
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // 1. Fetch User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_insight_index")
        .eq("id", user.id)
        .single();

      setCurrentInsightIndex(profile?.current_insight_index || 0);

      // 2. Fetch Scholarly Insights
      const { data: insightsData } = await supabase
        .from("scholarly_insights")
        .select("*")
        .order("id", { ascending: true });

      if (insightsData) setInsights(insightsData);

      // 3. Logic for Weekly Progress
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentProgress } = await supabase
        .from("user_video_progress")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", sevenDaysAgo.toISOString());

      const modulesCompletedThisWeek = recentProgress?.length || 0;
      const targetModulesPerWeek = 5;
      const progressCalculation = Math.min(Math.round((modulesCompletedThisWeek / targetModulesPerWeek) * 100), 100);
      setWeeklyProgressPct(progressCalculation);

      // 4. Calculate Pending Modules
      const { count: completedVideosCount } = await supabase
        .from("user_video_progress")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id);

      const { count: totalVideosCount } = await supabase
        .from("videos")
        .select("*", { count: 'exact', head: true });

      const pendingMods = Math.max(0, (totalVideosCount || 0) - (completedVideosCount || 0));

      setStats({
        liveSessions: 0, // Update this query when your specific live_sessions table is created
        pendingModules: pendingMods
      });

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInsightAsRead = async () => {
    if (!userId || insights.length === 0) return;
    const nextIndex = (currentInsightIndex + 1) % insights.length;
    setCurrentInsightIndex(nextIndex);
    await supabase.from("profiles").update({ current_insight_index: nextIndex }).eq("id", userId);
  };

  if (loading) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">Loading your journey...</div>;

  const currentInsight = insights[currentInsightIndex] || { content: "Loading insight...", author: "" };

  // Calculate SVG Circle values
  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (circleCircumference * weeklyProgressPct) / 100;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* TOP SECTION: Header Info (Left) & Weekly Progress (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Heading & Paragraph (h-48 equivalent) */}
          <div className="lg:col-span-2 flex flex-col justify-center min-h-[12rem]">
            <h1 className="text-4xl md:text-[44px] font-bold text-[#174778] mb-4 tracking-tight leading-tight">
              Continuing your journey
            </h1>
            <p className="text-gray-600 text-[17px] leading-relaxed max-w-2xl">
              Welcome back to our intellectual sanctuary. You have{" "}
              <span className="font-semibold text-[#174778]">{stats.liveSessions} pending live sessions</span>{" "}
              and{" "}
              <span className="font-semibold text-[#174778]">{stats.pendingModules} pending modules</span>{" "}
              across your enrolled masterclasses.
            </p>
          </div>

          {/* Right: Weekly Progress Widget */}
          <div className="lg:col-span-1">
            <section className="bg-[#4A2B23] text-white p-6 rounded-2xl shadow-md relative overflow-hidden h-full flex flex-col justify-center">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-[0.2em] text-[#E8DCCA] mb-2">Weekly Progress</h3>
                  <p className="text-[13px] text-[#E8DCCA] leading-relaxed max-w-[140px]">
                    {weeklyProgressPct >= 100
                      ? "Weekly goal reached!"
                      : "Complete more modules to reach your goal."}
                  </p>
                </div>

                {/* Custom SVG Circular Progress */}
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="transform -rotate-90 w-full h-full">
                    <circle cx="48" cy="48" r={circleRadius} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
                    <circle
                      cx="48" cy="48" r={circleRadius} stroke="#E6A15C" strokeWidth="6" fill="none"
                      strokeDasharray={circleCircumference} strokeDashoffset={circleOffset} strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold tracking-tighter">{weeklyProgressPct}%</span>
                  </div>
                </div>
              </div>

              {/* Decorative background shapes */}
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#E6A15C] opacity-5 rounded-full blur-3xl" />
            </section>
          </div>
        </div>

        {/* UPCOMING WEBINARS (Light UI Design) */}
        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-5 tracking-tight">Upcoming Webinars</h2>
          <Carousel className="w-full">
            <CarouselContent>
              {upcomingWebinars.map((webinar) => (
                <CarouselItem key={webinar.id} className="md:basis-1/2 lg:basis-1/3">
                  <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm h-44 flex flex-col justify-between group hover:shadow-md transition-all">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Event
                      </span>
                      <h3 className="font-bold text-[#0f172a] text-lg leading-snug">{webinar.title}</h3>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                        <Calendar size={14} />
                        <span>{webinar.date}</span>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-md border-gray-200">
                        Register
                      </Button>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden sm:block">
              <CarouselPrevious className="-left-4 bg-white border-gray-200 shadow-sm" />
              <CarouselNext className="-right-4 bg-white border-gray-200 shadow-sm" />
            </div>
          </Carousel>
        </section>

        {/* CURATED CURRICULUM */}
        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-5 tracking-tight">Curated Curriculum</h2>
          <div className="space-y-4">
            {curriculum.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-500 text-sm">
                No curriculum assigned yet.
              </div>
            ) : (
              curriculum.map((course) => (
                <div key={course.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center hover:shadow-md transition-shadow">

                  {/* Video Thumbnail Placeholder */}
                  <div className="w-full sm:w-56 h-32 bg-[#0f172a] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden group cursor-pointer">
                    <PlayCircle className="text-white/70 group-hover:text-white transition-colors z-10" size={40} strokeWidth={1.5} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>

                  {/* Content & Progress */}
                  <div className="flex-1 w-full py-1">
                    <h3 className="font-bold text-[#0f172a] text-[18px]">{course.title}</h3>
                    <p className="text-sm text-gray-500 mt-1.5 mb-5">{course.description}</p>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#174778] h-full rounded-full" style={{ width: `${course.progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-400">{course.progress}%</span>
                    </div>
                  </div>

                  {/* Resume Button */}
                  <div className="w-full sm:w-auto shrink-0 px-2">
                    <Button className="w-full sm:w-auto bg-[#174778] hover:bg-[#113a63] text-white rounded-lg flex items-center gap-2 px-6 py-5 shadow-sm">
                      Resume <PlayCircle size={18} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* SCHOLARLY INSIGHT (Moved to the bottom) */}
        <section className="bg-[#FDFBF7] border-l-[6px] border-[#8B4513] p-7 rounded-r-2xl shadow-sm relative mt-4">
          <div className="absolute right-4 top-4 text-[#8B4513]/5">
            <BookOpen size={80} />
          </div>

          <div className="flex items-center gap-2 mb-4 relative z-10">
            <BookOpen size={18} className="text-[#8B4513]" />
            <h3 className="font-bold text-[#8B4513] text-xs uppercase tracking-wider">Scholarly Insight</h3>
          </div>

          <div className="mb-6 relative z-10">
            {insights.length > 0 ? (
              <>
                <p className="text-[16px] text-[#3e2218] font-serif italic leading-relaxed max-w-4xl">
                  "{currentInsight.content}"
                </p>
                {currentInsight.author && (
                  <p className="text-[11px] text-gray-500 font-bold mt-4 tracking-wider uppercase">
                    — {currentInsight.author}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Cultivating new insights...</p>
            )}
          </div>

          <div className="relative z-10">
            <Button
              onClick={handleMarkInsightAsRead}
              disabled={insights.length === 0}
              variant="outline"
              className="bg-white border border-gray-200 text-[#8B4513] hover:bg-[#8B4513] hover:text-white hover:border-[#8B4513] rounded-lg transition-all flex items-center gap-2 shadow-sm font-semibold"
            >
              <CheckCircle2 size={16} /> Mark as Read
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
}