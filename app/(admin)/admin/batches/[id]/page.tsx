"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { upsertUserProgress } from "@/app/actions/user-progress";
import {
  PlayCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import CourseVideoPlayer from "@/app/(main)/courses/[id]/components/CourseVideoPlayer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchInfo {
  id: string;
  name: string;
  schedule_type: string | null;
  course_id: string | null;
  course_title: string | null;
  course_thumbnail: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string;
  video_cf_id: string;
  thumbnail_url?: string | null;
  created_at?: string | null;
  duration: string;
  order_index: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeId = (v: unknown) =>
  String(v ?? "").trim().replaceAll("-", "").toLowerCase();

const getModuleKey = (m: Pick<Module, "id">) => String(m.id);

const findModuleByLookupId = (list: Module[], value: unknown): Module | null => {
  const n = normalizeId(value);
  if (!n) return null;
  return (
    list.find(
      (m) => normalizeId(m.id) === n || normalizeId(m.video_cf_id) === n,
    ) ?? null
  );
};

const getModuleProgressIds = (m?: Module | null): string[] =>
  Array.from(
    new Set(
      [m?.id, m?.video_cf_id]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean),
    ),
  );

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Playback & progress
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
  const [playbackPositions, setPlaybackPositions] = useState<Record<string, number>>({});
  const [autoPlayModuleId, setAutoPlayModuleId] = useState<string | null>(null);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [completionError, setCompletionError] = useState("");

  // Admin module actions
  const [openModuleMenuId, setOpenModuleMenuId] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [moduleDeleteError, setModuleDeleteError] = useState("");

  const storageKey = (uid: string) => `batch_progress_${uid}_${id}`;
  const positionKey = (uid: string) => `batch_positions_${uid}_${id}`;

  // ─── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (id) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      setNotFound(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      // 1. Fetch batch row
      const { data: batchRow, error: batchErr } = await supabase
        .from("batches")
        .select("id, name, schedule_type, course_id, start_date")
        .eq("id", String(id))
        .maybeSingle();

      if (batchErr) {
        console.error("Batch fetch error:", batchErr.message);
        setNotFound(true);
        return;
      }
      if (!batchRow) {
        setNotFound(true);
        return;
      }

      // 2. Fetch parent course
      const courseId = batchRow.course_id ? String(batchRow.course_id) : null;
      let courseTitle: string | null = null;
      let courseThumbnail: string | null = null;

      if (courseId) {
        const { data: courseRow } = await supabase
          .from("maincourses")
          .select("title, thumbnail_url")
          .eq("id", courseId)
          .maybeSingle();
        courseTitle = courseRow?.title ?? null;
        courseThumbnail = courseRow?.thumbnail_url ?? null;
      }

      setBatch({
        id: String(batchRow.id),
        name: batchRow.name,
        schedule_type: batchRow.schedule_type ?? null,
        course_id: courseId,
        course_title: courseTitle,
        course_thumbnail: courseThumbnail,
      });

      // 3. Fetch modules via maincourse_id (batch inherits course modules)
      const mods: Module[] = [];
      if (courseId) {
        const { data: modRows, error: modErr } = await supabase
          .from("coursemodules")
          .select("*")
          .eq("maincourse_id", courseId)
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (modErr) {
          console.error("Modules fetch error:", modErr.message);
        } else {
          mods.push(...(modRows ?? []));
        }
      }
      setModules(mods);

      // 4. Load progress
      const progressMap: Record<string, boolean> = {};
      const posMap: Record<string, number> = {};

      if (courseId && mods.length > 0) {
        const { data: progressRows } = await supabase
          .from("user_video_progress")
          .select("video_id, completed, updated_at, last_position_seconds")
          .eq("user_id", user.id)
          .eq("course_id", courseId);

        const updatedAtMap: Record<string, string> = {};
        for (const p of progressRows ?? []) {
          const matched = findModuleByLookupId(mods, p.video_id);
          if (!matched) continue;
          const key = getModuleKey(matched);
          const ua = String(p.updated_at || "");
          if (!updatedAtMap[key] || ua >= updatedAtMap[key]) {
            progressMap[key] = Boolean(p.completed);
            posMap[key] = p.completed
              ? 0
              : Math.max(0, Number(p.last_position_seconds || 0));
            updatedAtMap[key] = ua;
          }
        }

        // Merge localStorage fallback
        try {
          const local = localStorage.getItem(storageKey(user.id));
          if (local) {
            const parsed = JSON.parse(local) as Record<string, boolean>;
            for (const [k, v] of Object.entries(parsed)) {
              if (v) progressMap[k] = true;
            }
          }
        } catch (_) {
          // ignore
        }
      }

      setUserProgress(progressMap);
      setPlaybackPositions(posMap);

      // 5. Auto-select first incomplete module
      if (mods.length > 0) {
        const firstIncomplete =
          mods.find((m) => !progressMap[getModuleKey(m)]) ?? mods[0];
        setActiveModuleId(getModuleKey(firstIncomplete));
      }
    } catch (e) {
      console.error("BatchDetailsPage loadData error:", e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  // ─── Progress helpers ────────────────────────────────────────────────────────

  function applyCompletion(moduleKey: string, completed: boolean) {
    setUserProgress((p) => ({ ...p, [moduleKey]: completed }));
    setPlaybackPositions((p) => ({ ...p, [moduleKey]: 0 }));
  }

  function saveLocalPosition(moduleId: string, seconds: number) {
    if (!userId) return;
    const mod = findModuleByLookupId(modules, moduleId);
    const key = getModuleKey(mod ?? { id: moduleId });
    setPlaybackPositions((p) => ({ ...p, [key]: Math.max(0, Math.floor(seconds)) }));
    try {
      const pk = positionKey(userId);
      const existing = localStorage.getItem(pk);
      const parsed = existing
        ? (JSON.parse(existing) as Record<string, number>)
        : {};
      parsed[key] = Math.max(0, Math.floor(seconds));
      getModuleProgressIds(mod).forEach((pid) => {
        parsed[pid] = parsed[key];
      });
      localStorage.setItem(pk, JSON.stringify(parsed));
    } catch (_) {
      // ignore
    }
  }

  async function handleMarkAsCompleted(moduleId: string) {
    if (!userId || !batch?.course_id) return;
    const moduleKey = String(moduleId);
    const nextState = !userProgress[moduleKey];
    const mod = findModuleByLookupId(modules, moduleKey);
    const persistIds = getModuleProgressIds(mod);
    const primaryId = persistIds[0] || moduleKey;

    try {
      setIsMarkingCompleted(true);
      setCompletionError("");
      applyCompletion(moduleKey, nextState);

      try {
        const sk = storageKey(userId);
        const existing = localStorage.getItem(sk);
        const parsed = existing
          ? (JSON.parse(existing) as Record<string, boolean>)
          : {};
        parsed[moduleKey] = nextState;
        persistIds.forEach((pid) => {
          parsed[pid] = nextState;
        });
        localStorage.setItem(sk, JSON.stringify(parsed));
      } catch (_) {
        // ignore
      }

      await upsertUserProgress(
        userId,
        batch.course_id,
        primaryId,
        nextState ? 100 : 0,
        nextState,
        persistIds,
      );
    } catch (_) {
      setCompletionError("Unable to save completion. Please try again.");
    } finally {
      setIsMarkingCompleted(false);
    }
  }

  async function handleDeleteModule(mod: Module) {
    if (deletingModuleId) return;
    if (!window.confirm(`Delete "${mod.title}"? This cannot be undone.`)) return;

    try {
      setDeletingModuleId(String(mod.id));
      setModuleDeleteError("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Please log in again.");
      }

      const res = await fetch(
        `/api/admin/coursemodules?moduleId=${encodeURIComponent(
          String(mod.id),
        )}&courseId=${encodeURIComponent(String(batch?.course_id ?? ""))}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || `Request failed (${res.status}).`);
      }

      const deletedKey = getModuleKey(mod);
      const nextModules = modules.filter((m) => getModuleKey(m) !== deletedKey);
      setModules(nextModules);
      setUserProgress((p) => {
        const n = { ...p };
        getModuleProgressIds(mod).forEach((pid) => delete n[pid]);
        return n;
      });
      if (
        activeModuleId &&
        getModuleProgressIds(mod).includes(activeModuleId)
      ) {
        setActiveModuleId(
          nextModules[0] ? getModuleKey(nextModules[0]) : null,
        );
      }
      setOpenModuleMenuId(null);
    } catch (e) {
      setModuleDeleteError(
        e instanceof Error ? e.message : "Failed to delete module.",
      );
    } finally {
      setDeletingModuleId(null);
    }
  }

  function selectModule(key: string) {
    setAutoPlayModuleId(null);
    setActiveModuleId(key);
    setOpenModuleMenuId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Derived values ──────────────────────────────────────────────────────────

  const activeModule = useMemo(
    () => findModuleByLookupId(modules, activeModuleId),
    [modules, activeModuleId],
  );

  const videoEmbedUrl = useMemo(() => {
    if (!activeModule?.video_cf_id) return null;
    const raw = activeModule.video_cf_id.trim();
    if (!raw) return null;
    if (raw.startsWith("https://iframe.videodelivery.net/")) return raw;
    const cleanId = raw.split("?")[0].split("/").pop() || "";
    return cleanId ? `https://iframe.videodelivery.net/${cleanId}` : null;
  }, [activeModule]);

  const playerThumbnailUrl = useMemo(() => {
    const explicit = String(activeModule?.thumbnail_url || "").trim();
    if (explicit) return explicit;
    const raw = String(activeModule?.video_cf_id || "").trim();
    if (!raw) return null;
    const cleanId = raw.split("?")[0].split("/").pop() || "";
    return cleanId
      ? `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s`
      : null;
  }, [activeModule]);

  const progressPercentage = useMemo(() => {
    if (modules.length === 0) return 0;
    const done = modules.filter((m) => userProgress[String(m.id)]).length;
    return Math.round((done / modules.length) * 100);
  }, [modules, userProgress]);

  const totalDuration = useMemo(() => {
    let secs = 0;
    modules.forEach((m) => {
      if (m.duration) {
        const parts = m.duration.split(":").map(Number);
        if (parts.length === 3) secs += parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) secs += parts[0] * 60 + parts[1];
      }
    });
    if (secs === 0) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m Total` : `${m}m Total`;
  }, [modules]);

  // ─── Loading / not-found states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !batch) {
    return (
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-3xl shadow-sm border border-gray-100 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2`}>
            Batch Not Found
          </h2>
          <p className="text-gray-500 mb-6">
            This batch could not be found. It may have been deleted.
          </p>
          <Button onClick={() => router.push("/admin/batches")}>
            <ChevronLeft size={16} className="mr-1" /> Back to Batches
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-subtle font-sans text-gray-900">

      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/batches")}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-brand-heading"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                {batch.course_title ?? "Batch"}
              </span>
              <h1 className="text-sm font-bold text-gray-900 truncate max-w-[300px]">
                {batch.name}
              </h1>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Module Progress
            </span>
            <div className="flex items-center gap-3">
              <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-heading transition-all duration-700 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-brand-heading">
                {progressPercentage}%
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">

        {/* Left: video + overview */}
        <div className="lg:col-span-9 p-4 sm:p-6 lg:p-8 lg:border-r border-gray-100 bg-white/30">
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

            {/* Video player */}
            <div className="relative aspect-video bg-black rounded-xl sm:rounded-[2rem] overflow-hidden shadow-2xl border-4 sm:border-[8px] border-white ring-1 ring-gray-100">
              {activeModule && userId && videoEmbedUrl ? (
                <CourseVideoPlayer
                  key={`${activeModule.id}-${videoEmbedUrl}`}
                  userId={userId}
                  courseId={batch.course_id ?? String(id)}
                  moduleId={String(activeModule.video_cf_id || activeModule.id)}
                  videoUrl={videoEmbedUrl}
                  thumbnailUrl={playerThumbnailUrl}
                  autoPlay={autoPlayModuleId === String(activeModule.id)}
                  initialPositionSeconds={
                    playbackPositions[String(activeModule.id)] || 0
                  }
                  progressAliasIds={getModuleProgressIds(activeModule)}
                  onProgressPosition={(sec) =>
                    saveLocalPosition(String(activeModule.id), sec)
                  }
                  onCompleted={() => {
                    const key = String(activeModule.id);
                    applyCompletion(key, true);
                    const idx = modules.findIndex(
                      (m) => String(m.id) === key,
                    );
                    const next = idx >= 0 ? modules[idx + 1] : null;
                    if (next) {
                      saveLocalPosition(String(next.id), 0);
                      setAutoPlayModuleId(String(next.id));
                      setActiveModuleId(String(next.id));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      setAutoPlayModuleId(null);
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-gray-900 to-gray-800">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                    <PlayCircle
                      size={40}
                      className="text-white opacity-80"
                      strokeWidth={1}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {activeModule?.title || "Select a module"}
                  </h3>
                  <p className="text-gray-400 text-sm max-w-sm">
                    {modules.length === 0
                      ? "No modules available for this batch yet."
                      : "Instructional media for this module is being processed."}
                  </p>
                </div>
              )}
            </div>

            {/* Module overview */}
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-brand-heading text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                  Module{" "}
                  {modules.findIndex(
                    (m) => getModuleKey(m) === activeModuleId,
                  ) + 1}
                </span>
                {activeModuleId && userProgress[String(activeModuleId)] && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Completed
                  </span>
                )}
              </div>

              <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                {activeModule?.title || "Select a module from the sidebar"}
              </h2>

              {activeModuleId && (
                <Button
                  onClick={() => handleMarkAsCompleted(activeModuleId)}
                  disabled={isMarkingCompleted || !activeModule?.video_cf_id}
                  className={`rounded-full px-6 py-5 text-xs font-bold tracking-wide transition ${
                    !activeModule?.video_cf_id
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : userProgress[String(activeModuleId)]
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-brand-heading hover:bg-brand-heading-hover text-white"
                  }`}
                >
                  {isMarkingCompleted
                    ? "Saving..."
                    : userProgress[String(activeModuleId)]
                    ? "Mark as Incomplete"
                    : "Mark as Complete"}
                </Button>
              )}

              {completionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {completionError}
                </div>
              )}

              {activeModule?.description && (
                <p className="text-gray-600 leading-relaxed text-[15px]">
                  {activeModule.description}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Right: module sidebar */}
        <div className="hidden lg:flex lg:col-span-3 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] overflow-y-auto border-l border-gray-100 flex-col">

          <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left shrink-0">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
              Curriculum — {batch.name}
            </h3>
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} /> {modules.length} Modules
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {totalDuration || "—"}
              </span>
            </div>
          </div>

          {moduleDeleteError && (
            <div className="mx-5 mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {moduleDeleteError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {modules.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <BookOpen size={32} className="mx-auto mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  No modules available
                </p>
                <p className="text-[11px] mt-1 text-gray-300">
                  No modules available for this batch yet.
                </p>
              </div>
            ) : (
              modules.map((mod, index) => {
                const key = getModuleKey(mod);
                const isActive = key === activeModuleId;
                const isCompleted = !!userProgress[key];

                return (
                  <div
                    key={mod.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectModule(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectModule(key);
                      }
                    }}
                    className={`relative w-full cursor-pointer text-left p-5 transition-all flex items-start gap-4 group ${
                      isActive
                        ? "bg-blue-50/50 border-r-4 border-brand-heading"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : isActive
                          ? "bg-brand-heading border-brand-heading text-white"
                          : "bg-white border-gray-200 text-gray-400 group-hover:border-brand-heading group-hover:text-brand-heading"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 size={14} /> : index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-sm font-bold mb-1 leading-snug transition-colors ${
                          isActive
                            ? "text-brand-heading"
                            : "text-gray-900 group-hover:text-brand-heading"
                        }`}
                      >
                        {mod.title}
                      </h4>
                      {mod.description && (
                        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-1.5">
                          {mod.description}
                        </p>
                      )}
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> {mod.duration || "—"}
                      </span>
                    </div>

                    {/* Admin delete menu */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenModuleMenuId((c) =>
                            c === key ? null : key,
                          );
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="rounded-lg p-1.5 text-gray-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-colors hover:bg-white hover:text-gray-700"
                        aria-label={`Actions for ${mod.title}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openModuleMenuId === key && (
                        <div
                          className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(mod)}
                            disabled={deletingModuleId === String(mod.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {deletingModuleId === String(mod.id)
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
