"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { getMyLearningData } from "@/app/actions/my-learning";
import { getCourseProgress } from "@/app/actions/get-course-progress";
import { useRouter } from "next/navigation";
import CourseCard from "@/app/components/course/CourseCard";
import Certificate from "@/app/components/certificate/Certificate";
import CertificateDownload from "@/app/components/certificate/CertificateDownload";
import {Button} from "@/components/ui/button";
import {ICONS} from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { BookOpen, PlayCircle, CheckCircle2, Award, ExternalLink, X } from "lucide-react";

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

interface CurriculumCourse {
  id: number | string;
  title: string;
  description: string;
  module_label?: string;
  progress: number;
  thumbnail_url?: string;
  duration?: string;
  modules?: any[]; // Array of modules
  certificate_url?: string | null;
  certificate_id?: string | null;
issued_at?: string | null;
}

interface Webinar {
  id: number;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
  status: string;
  linkText: string;
  attendees: number;
}

interface Enrollment {
  batchId: number | string;
  batchName: string;
  startDate: string | null;
  courseId: number | string | null;
  courseTitle: string;
  courseDescription: string;
}

interface UpcomingEventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: "video" | "course" | "session" | "webinar";
}

interface UpcomingWebinarCard {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
  status: "streaming" | "link";
  linkText?: string;
  attendees: number;
}

const normalizeId = (id: string | null | undefined) =>
  String(id || "").replace(/-/g, "").trim().toLowerCase();

function resolveModuleCompletion(modules: any[] = [], progressRows: any[] = []) {
  const completionByModuleId = new Map<string, boolean>();
  const updatedAtByModuleId = new Map<string, string>();

  for (const progress of progressRows) {
    const normalizedProgressId = normalizeId(progress.video_id);
    if (!normalizedProgressId) continue;

    const matchedModule = modules.find((module: any) => {
      return (
        normalizeId(module.id) === normalizedProgressId ||
        normalizeId(module.video_cf_id) === normalizedProgressId
      );
    });

    if (!matchedModule) continue;

    const moduleId = String(matchedModule.id);
    const updatedAt = String(progress.updated_at || "");
    const previousUpdatedAt = updatedAtByModuleId.get(moduleId);

    if (!previousUpdatedAt || updatedAt >= previousUpdatedAt) {
      completionByModuleId.set(moduleId, Boolean(progress.completed));
      updatedAtByModuleId.set(moduleId, updatedAt);
    }
  }

  return completionByModuleId;
}

export default function MyLearningDashboard() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);
  const [userId, setUserId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [upcomingWebinars, setUpcomingWebinars] = useState<
    UpcomingWebinarCard[]
  >([]);

  // Tab & Certificate states
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");
  const [selectedCertificateCourse, setSelectedCertificateCourse] = useState<CurriculumCourse | null>(null);
  const [userProfileName, setUserProfileName] = useState<string>("Learner");

  // Data States
  const [stats, setStats] = useState<UserStats>({
    liveSessions: 0,
    pendingModules: 0,
  });
  const [weeklyProgressPct, setWeeklyProgressPct] = useState(0);
  const [courseProgress, setCourseProgress] = useState<Record<string, { progressPercentage: number; completedModules: number; totalModules: number }>>({});

  const router = useRouter();

  // Insight States
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Curriculum State
  const [curriculum, setCurriculum] = useState<CurriculumCourse[]>([]);

  const formatWebinarDate = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeLabel = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (dateObj.toDateString() === now.toDateString()) {
      return `TODAY, ${timeLabel}`;
    }
    if (dateObj.toDateString() === tomorrow.toDateString()) {
      return `TOMORROW, ${timeLabel}`;
    }
    return `${dateObj
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase()}, ${timeLabel}`;
  };

async function loadDashboardData() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    setUserId(session.user.id);

    // --------------------------------------------------
    // HELPER
    // --------------------------------------------------
    const normalizeId = (id: string | null | undefined) =>
      String(id || "")
        .replace(/-/g, "")
        .toLowerCase();

    // --------------------------------------------------
    // USER PROFILE
    // --------------------------------------------------
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_insight_index, full_name")
      .eq("id", session.user.id)
      .single();

    setCurrentInsightIndex(profile?.current_insight_index || 0);

    setUserProfileName(
      profile?.full_name ||
        session.user.email?.split("@")[0] ||
        "Learner"
    );

    // --------------------------------------------------
    // INSIGHTS
    // --------------------------------------------------
    const { data: insightsData } = await supabase
      .from("scholarly_insights")
      .select("*")
      .order("id", { ascending: true });

    if (insightsData) {
      setInsights(insightsData);
    }

    // --------------------------------------------------
    // WEBINARS
    // --------------------------------------------------
    const { data: webinarsData } = await supabase
      .from("webinars")
      .select("*")
      .order("created_at", { ascending: true });

    const mappedWebinars =
      webinarsData?.map((w: any) => ({
        id: w.id,
        title: w.title,
        subtitle: w.subtitle,
        date: w.event_date,
        icon: w.icon,
        status: w.status,
        linkText: w.link_text,
        attendees: w.attendees_count,
      })) || [];

    setUpcomingWebinars(mappedWebinars);

    setStats((prev) => ({
      ...prev,
      liveSessions: mappedWebinars.length,
    }));

    // --------------------------------------------------
    // FETCH ENROLLMENTS + COURSES + MODULES
    // --------------------------------------------------
    const { data: enrollmentsData } = await supabase
      .from("course_enrollments")
      .select(`
        course_id,
        maincourses (
          id,
          title,
          description,
          category,
          thumbnail_url,
          coursemodules (*)
        )
      `)
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // FETCH VIDEO PROGRESS
    // --------------------------------------------------
    const { data: progressData } = await supabase
      .from("user_video_progress")
      .select("course_id, video_id, completed, updated_at")
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // FETCH CERTIFICATES
    // --------------------------------------------------
    const { data: certsData } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // NO COURSES
    // --------------------------------------------------
    if (!enrollmentsData || enrollmentsData.length === 0) {
      setCurriculum([]);
      setCourseProgress({});
      setWeeklyProgressPct(0);

      setStats((prev) => ({
        ...prev,
        pendingModules: 0,
      }));

      return;
    }

    // --------------------------------------------------
    // VALID ENROLLMENTS
    // --------------------------------------------------
    const validEnrollments = enrollmentsData.filter(
      (e: any) => e.maincourses
    );

    // --------------------------------------------------
    // BUILD CURRICULUM
    // --------------------------------------------------
    const progressMap: Record<
      string,
      {
        progressPercentage: number;
        completedModules: number;
        totalModules: number;
      }
    > = {};

    const mappedCurriculum = validEnrollments.map((e: any) => {
      const course = e.maincourses;

      const modules = (course.coursemodules || []).sort(
        (a: any, b: any) =>
          (a.order_index ?? 0) - (b.order_index ?? 0)
      );

      const totalModules = modules.length;

      // ------------------------------------------
      // COURSE PROGRESS ROWS
      // ------------------------------------------
      const courseProgressRows =
        progressData?.filter(
          (p: any) =>
            String(p.course_id) === String(course.id)
        ) || [];

      const moduleCompletion = resolveModuleCompletion(
        modules,
        courseProgressRows,
      );

      // ------------------------------------------
      // COMPLETED MODULES
      // ------------------------------------------
      const completedModules = modules.filter((m: any) => {
        return moduleCompletion.get(String(m.id));
      }).length;

      // ------------------------------------------
      // PERCENTAGE
      // ------------------------------------------
      const progressPercentage =
        totalModules > 0
          ? Math.round(
              (completedModules / totalModules) * 100
            )
          : 0;

      // ------------------------------------------
      // STORE PROGRESS MAP
      // ------------------------------------------
      progressMap[String(course.id)] = {
        progressPercentage,
        completedModules,
        totalModules,
      };

      // ------------------------------------------
      // CERTIFICATE
      // ------------------------------------------
      const cert =
        certsData?.find(
          (c: any) =>
            String(c.course_id) === String(course.id)
        ) || null;

      // ------------------------------------------
      // RETURN COURSE
      // ------------------------------------------
      return {
        id: course.id,
        title: course.title,
        description:
          course.description ||
          "Course description unavailable.",
      
        module_label: course.category
          ? course.category.toUpperCase()
          : "GENERAL",
      
        thumbnail_url: course.thumbnail_url,
      
        progress: progressPercentage,
      
        modules,
      
        certificate_id: cert?.id || null,
      
        issued_at: cert?.issued_at || null,
      
        certificate_url:
          cert?.certificate_url || null,
      
        duration:
          progressPercentage === 0
            ? "Ready to begin"
            : progressPercentage === 100
            ? "Completed"
            : `${completedModules}/${totalModules} Modules`,
      };
    });

    // --------------------------------------------------
    // SET STATES
    // --------------------------------------------------
    setCurriculum(mappedCurriculum);

    setCourseProgress(progressMap);

    // --------------------------------------------------
    // OVERALL PROGRESS
    // --------------------------------------------------
    const avgProgress =
      mappedCurriculum.length > 0
        ? Math.round(
            mappedCurriculum.reduce(
              (sum, c) => sum + c.progress,
              0
            ) / mappedCurriculum.length
          )
        : 0;

    setWeeklyProgressPct(avgProgress);

    // --------------------------------------------------
    // PENDING MODULES
    // --------------------------------------------------
    const totalPendingModules = Object.values(
      progressMap
    ).reduce((sum, item) => {
      return (
        sum +
        Math.max(
          0,
          item.totalModules - item.completedModules
        )
      );
    }, 0);

    setStats((prev) => ({
      ...prev,
      pendingModules: totalPendingModules,
    }));
  } catch (error) {
    console.error("Error loading dashboard:", error);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time listener for progress updates
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`user_video_progress:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_video_progress',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Re-load all dashboard data when any progress change occurs
          await loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
 }, [userId]);

  
  const handleMarkInsightAsRead = async () => {
    if (!userId || insights.length === 0) return;
    const nextIndex = (currentInsightIndex + 1) % insights.length;
    setCurrentInsightIndex(nextIndex);
    await supabase
      .from("profiles")
      .update({ current_insight_index: nextIndex })
      .eq("id", userId);
  };



  const currentInsight = insights[currentInsightIndex] || {
    content: "Loading insight...",
    author: "",
  };

  // Calculate SVG Circle values
  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset =
    circleCircumference - (circleCircumference * weeklyProgressPct) / 100;

  const activeCourses = curriculum.filter((course) => course.progress < 100);
  const completedCourses = curriculum.filter((course) => course.progress === 100);
  console.log("COMPLETED COURSES", completedCourses);

  
console.log("ACTIVE COURSES", activeCourses);
console.log("COURSE PROGRESS", courseProgress);

  return (
    <div className="min-h-screen bg-surface-subtle p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* â”€â”€â”€ TOP SECTION: Header + Weekly Progress â”€â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Heading & Stats */}
          <div className="lg:col-span-2 flex flex-col justify-center min-h-48">
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Continuing Your Journey
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-[17px] leading-relaxed max-w-2xl">
              Welcome back to{" "}
              <span className="font-bold text-brand-primary">The Automate</span>.
              You have{" "}
              <span className="font-semibold text-brand-info underline decoration-dotted underline-offset-4">
                {stats.liveSessions} upcoming webinars
              </span>{" "}
              and{" "}
              <span className="font-semibold text-brand-success underline decoration-dotted underline-offset-4">
                {stats.pendingModules} pending module
                {stats.pendingModules !== 1 ? "s" : ""}
              </span>{" "}
              in your core curriculum.
            </p>
          </div>

          {/* Right: Weekly Progress Widget */}
          <div className="lg:col-span-1">
            <section className="bg-gradient-to-br from-brand-heading to-brand-primary text-white p-6 rounded-2xl shadow-md relative overflow-hidden h-full flex flex-col justify-center">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-[0.2em] text-blue-100 mb-2">
                    Weekly Progress
                  </h3>
                  <p className="text-[13px] text-blue-50 leading-relaxed max-w-[140px]">
                    {weeklyProgressPct >= 100
                      ? "Weekly goal reached!"
                      : "Complete more modules to reach your goal."}
                  </p>
                </div>

                {/* Custom SVG Circular Progress */}
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="transform -rotate-90 w-full h-full">
                    <circle
                      cx="48"
                      cy="48"
                      r={circleRadius}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={circleRadius}
                      stroke="#ffffff"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={circleOffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold tracking-tighter">
                      {weeklyProgressPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Decorative background */}
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl" />
            </section>
          </div>
        </div>
                    {/* Course Carousel */}
       <div className="relative">
  <Carousel
    opts={{
      align: "start",
      loop: false,
      dragFree: true,
    }}
    className="w-full"
  >
    <CarouselContent className="-ml-4 sm:-ml-6 pb-6">
      {activeCourses.map((course) => (
        <CarouselItem
          key={course.id}
          className="
            pl-4
            sm:pl-6
            basis-[85vw]
            sm:basis-1/2
            lg:basis-1/3
          "
        >
          <CourseCard
            id={course.id}
            title={course.title}
            description={course.description}
            thumbnail={course.thumbnail_url}
            category={course.module_label}
            duration={course.duration}
            progressPercentage={
              courseProgress[String(course.id)]
                ?.progressPercentage || 0
            }
            showProgress
            variant="user"
            onClick={() =>
              router.push(`/courses/${course.id}`)
            }
          />
        </CarouselItem>
      ))}
    </CarouselContent>

    {activeCourses.length > 1 && (
      <>
        <CarouselPrevious className="flex left-2 lg:-left-5 bg-white dark:bg-slate-800 shadow-lg border border-gray-100 dark:border-white/10 text-brand-primary hover:bg-gray-50 dark:hover:bg-slate-700 h-8 w-8 lg:h-10 lg:w-10 z-10" />
        <CarouselNext className="flex right-2 lg:-right-5 bg-white dark:bg-slate-800 shadow-lg border border-gray-100 dark:border-white/10 text-brand-primary hover:bg-gray-50 dark:hover:bg-slate-700 h-8 w-8 lg:h-10 lg:w-10 z-10" />
      </>
    )}
  </Carousel>
</div>

{/*Completed courses */}
<section className="mt-12 text-gray-900 dark:text-gray-100">
  <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
    Completed Courses
  </h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
    {completedCourses.map((course) => (
      <div
        key={course.id}
        className="flex flex-col h-full"
      >
        <CourseCard
          id={course.id}
          title={course.title}
          description={course.description}
          thumbnail={course.thumbnail_url}
          variant="user"
          progressPercentage={100}
          showProgress={true}
          onClick={() => router.push(`/courses/${course.id}`)}
        />
        {course.progress === 100 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCertificateCourse(course);
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-heading text-white text-sm font-semibold rounded-xl hover:bg-brand-heading/90 transition-colors shadow-sm"
          >
            <Award size={16} />
            Download Certificate
          </button>
        )}
      </div>
    ))}
  </div>
</section>

        {/* â”€â”€â”€ THE AUTOMATE INSIGHT â”€â”€â”€ */}
        <section className="bg-gradient-to-r from-surface-accent-start to-surface-accent-end border-l-[6px] border-brand-primary p-7 rounded-r-2xl shadow-sm relative">
          <div className="absolute right-6 top-6 text-brand-primary/10">
            <BookOpen size={80} />
          </div>

          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-brand-heading text-base">
              The Automate Insight
            </h3>
          </div>

          <div className="mb-6 relative z-10">
            {insights.length > 0 ? (
              <>
                <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed max-w-4xl">
                  &quot;{currentInsight.content}&quot;
                </p>
                {currentInsight.author && (
                  <p className="text-[11px] text-brand-hover font-bold mt-4 tracking-wider uppercase">
                    &mdash; {currentInsight.author}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cultivating new insights...
              </p>
            )}
          </div>

          <div className="relative z-10 flex justify-end">
            <Button
              onClick={handleMarkInsightAsRead}
              disabled={insights.length === 0}
              className={`w-full sm:w-auto ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
            > Mark as Read
            </Button>
          </div>
        </section>
      </div>

      {/* ─── CERTIFICATE MODAL ─── */}
      {selectedCertificateCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 dark:border-white/10 relative p-1 bg-gradient-to-br from-amber-400 via-white dark:via-slate-800 to-amber-400 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="bg-white rounded-[22px] p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center relative border border-amber-500/10">
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedCertificateCourse(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              {/* Responsive Certificate Preview */}
              <div className="w-full overflow-hidden flex justify-center items-center py-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6 h-[300px] sm:h-[450px]">
                <div className="scale-[0.3] sm:scale-[0.5] md:scale-[0.6] origin-center shadow-lg rounded-lg border bg-white overflow-hidden shrink-0">
                  <Certificate
                    userName={userProfileName}
                    courseName={selectedCertificateCourse.title}
                    completedDate={new Date(selectedCertificateCourse.issued_at || new Date()).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  />
                </div>
              </div>

              <div className="mb-2">
                <CertificateDownload
                  userName={userProfileName}
                  courseName={selectedCertificateCourse.title}
                  completedDate={new Date(selectedCertificateCourse.issued_at || new Date()).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
