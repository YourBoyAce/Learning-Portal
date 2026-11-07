"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import Link from "next/link";
import { supabase, resolveUserName } from "@/app/lib/supabase";
import { getMyLearningData } from "@/app/actions/my-learning";
import { calculateCourseProgress } from "@/app/lib/course-progress";
import { useRouter } from "next/navigation";
import CourseCard from "@/app/components/course/CourseCard";
import CourseCardSkeleton from "@/app/components/course/CourseCardSkeleton";
import Certificate from "@/app/components/certificate/Certificate";
import CertificateDownload from "@/app/components/certificate/CertificateDownload";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { PlayCircle, CheckCircle2, ExternalLink, X } from "lucide-react";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";

// --- Types ---
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
  modules?: any[];
  certificate_url?: string | null;
  certificate_id?: string | null;
  issued_at?: string | null;
  product_id?: string | number | null;
  whatsapp_community_link?: string | null;
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

export default function MyLearningDashboard() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  const { isLoading: isTierLoading, tier, canAccess } = useSecurityGatedData();
  const isCurrentlyLoading = loading || isTierLoading;

  useEffect(() => {
    setGlobalLoading(isCurrentlyLoading);
    return () => setGlobalLoading(false);
  }, [isCurrentlyLoading, setGlobalLoading]);
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
      const resolvedName = await resolveUserName(supabase, session.user.id, session.user.email);
      setUserProfileName(resolvedName);

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

      // Get the user's course memberships (direct, no batch hop)
      const userEmail = session.user.email?.trim().toLowerCase() || "";

      const { data: enrollmentsData } = await supabase
        .schema("phase2")
        .from("enrollments")
        .select("course_id, product_id, users!inner(auth_user_id)")
        .eq("users.auth_user_id", session.user.id)
        .eq("status", "active");

      const { data: courseMembersData } = await supabase
        .from("course_members")
        .select("maincourse_id")
        .eq("email", userEmail)
        .eq("status", "active");

      const enrollmentCourseIds = enrollmentsData?.map((e: any) => e.course_id).filter(Boolean) || [];
      const enrollmentProductIds = enrollmentsData?.map((e: any) => e.product_id).filter(Boolean) || [];
      const memberCourseIds = courseMembersData?.map((m: any) => m.maincourse_id).filter(Boolean) || [];
      
      const directCourseIds = Array.from(new Set([...enrollmentCourseIds, ...memberCourseIds]));

      let validEnrollments: any[] = [];
      if (directCourseIds.length > 0 || enrollmentProductIds.length > 0) {
        let courseQuery = supabase
          .from("maincourses")
          .select(`
            id,
            title,
            description,
            category,
            thumbnail_url,
            product_id,
            whatsapp_community_link,
            coursemodules (*)
          `);

        if (directCourseIds.length > 0 && enrollmentProductIds.length > 0) {
          courseQuery = courseQuery.or(
            `id.in.(${directCourseIds.join(",")}),product_id.in.(${enrollmentProductIds.join(",")})`
          );
        } else if (directCourseIds.length > 0) {
          courseQuery = courseQuery.in("id", directCourseIds);
        } else {
          courseQuery = courseQuery.in("product_id", enrollmentProductIds);
        }

        const { data: maincoursesData } = await courseQuery;
        if (maincoursesData) {
          validEnrollments = maincoursesData.map(mc => ({ maincourses: mc }));
        }
      }

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
      if (validEnrollments.length === 0) {
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
      // VALID ENROLLMENTS (already structured above)
      // --------------------------------------------------

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

        // Modules belong to the course (via maincourse_id), not the batch.
        // All course modules are available to all batches of that course.
        const allCourseModules = (course.coursemodules || []) as any[];
        const scopedModules = allCourseModules;

        const modules = scopedModules.sort(
          (a: any, b: any) =>
            (a.order_index ?? 0) - (b.order_index ?? 0)
        );

        // ------------------------------------------
        // COURSE PROGRESS ROWS
        // ------------------------------------------
        const courseProgressRows =
          progressData?.filter(
            (p: any) =>
              String(p.course_id) === String(course.id)
          ) || [];

        const courseProgress = calculateCourseProgress(
          modules,
          courseProgressRows,
        );

        // ------------------------------------------
        // STORE PROGRESS MAP
        // ------------------------------------------
        progressMap[String(course.id)] = {
          progressPercentage: courseProgress.progressPercentage,
          completedModules: courseProgress.completedModules,
          totalModules: courseProgress.totalModules,
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

          progress: courseProgress.progressPercentage,

          modules,

          certificate_id: cert?.id || null,

          issued_at: cert?.issued_at || null,

          certificate_url:
            cert?.certificate_url || null,

          duration:
            courseProgress.progressPercentage === 0
              ? "Ready to begin"
              : courseProgress.progressPercentage === 100
                ? "Completed"
                : `${courseProgress.completedModules}/${courseProgress.totalModules} Modules`,

          product_id: course.product_id ?? null,

          whatsapp_community_link: course.whatsapp_community_link ?? null,

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
        {!isTierLoading && tier === null ? (
          <div className="py-10">
            <UpgradeRequired
              title="Academic Curriculum Gated"
              description="Your access to courses, videos, and chat communities is currently locked. To view your enrolled cohorts and study path, please subscribe to an active learning plan."
              requiredTier="Starter"
            />
          </div>
        ) : (
          <>
            {/* ─── TOP SECTION: Header + Weekly Progress ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Heading & Stats */}
              <div className="lg:col-span-2 flex flex-col justify-center min-h-48">
                <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
                  Continuing Your Journey
                </h1>
                <p className="text-gray-600 text-[17px] leading-relaxed max-w-2xl">
                  Welcome back to{" "}
                  <span className="font-bold text-brand-primary">The Automate</span>.
                  You have{" "}
                  {!isTierLoading && canAccess("Webinars") && stats.liveSessions > 0 ? (
                    <>
                      <span className="font-semibold text-brand-info underline decoration-dotted underline-offset-4">
                        {stats.liveSessions} upcoming webinar{stats.liveSessions !== 1 ? "s" : ""}
                      </span>{" "}
                      and{" "}
                    </>
                  ) : null}
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
                  {loading
                    ? // ── Skeleton placeholders while fetching ──
                      [0, 1, 2].map((i) => (
                        <CarouselItem
                          key={i}
                          className="
                    pl-4
                    sm:pl-6
                    basis-[85vw]
                    sm:basis-1/2
                    lg:basis-1/3
                  "
                        >
                          <CourseCardSkeleton />
                        </CarouselItem>
                      ))
                    : activeCourses.map((course) => (
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
                            description={course.description || ""}
                            thumbnail={course.thumbnail_url}
                            category={course.module_label}
                            duration={course.duration}
                            progressPercentage={
                              courseProgress[String(course.id)]
                                ?.progressPercentage || 0
                            }
                            showProgress
                            variant="user"
                            whatsappLink={course.whatsapp_community_link}
                            onClick={() =>
                              router.push(`/courses/${course.id}`)
                            }
                          />
                        </CarouselItem>
                      ))}
                </CarouselContent>
                {!loading && activeCourses.length > 1 && (
                  <>
                    <CarouselPrevious className="flex left-2 lg:-left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                    <CarouselNext className="flex right-2 lg:-right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                  </>
                )}
              </Carousel>
            </div>

            {/*Completed courses */}
            {(!loading && completedCourses.length > 0) && (
              <section className="mt-12 text-gray-900">
                <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                  Completed Courses
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  {completedCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnail={course.thumbnail_url}
                      variant="user"
                      progressPercentage={100}
                      showProgress={true}
                      isCompleted={course.progress === 100}
                      whatsappLink={course.whatsapp_community_link}
                      onCertificateClick={() => setSelectedCertificateCourse(course)}
                      onClick={() => router.push(`/courses/${course.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

          </>
        )}
      </div>

      {/* ─── CERTIFICATE MODAL ─── */}
      {selectedCertificateCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 relative p-1 bg-gradient-to-br from-amber-400 via-white to-amber-400 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="bg-white rounded-[22px] p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center text-center relative border border-amber-500/10">

              {/* Close Button */}
              <button
                onClick={() => setSelectedCertificateCourse(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>

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
