export interface CourseProgressModule {
  id: string | number;
  video_cf_id?: string | null;
  module_type?: string | null;
  questions?: unknown;
}

export interface CourseProgressRow {
  video_id: string;
  completed: boolean;
  updated_at?: string | null;
}

const normalizeId = (id: string | number | null | undefined) =>
  String(id || "").replace(/-/g, "").trim().toLowerCase();

export function isCourseModuleAvailable(module: CourseProgressModule) {
  const moduleType = module.module_type || "video";

  if (moduleType === "video") {
    return Boolean(module.video_cf_id?.trim());
  }

  if (moduleType === "quiz") {
    return Array.isArray(module.questions) && module.questions.length > 0;
  }

  const artifact = Array.isArray(module.questions) ? module.questions[0] : null;
  if (!artifact || typeof artifact !== "object") return false;

  const artifactData = artifact as { text?: unknown; correctAnswer?: unknown };
  return (
    typeof artifactData.text === "string" &&
    Boolean(artifactData.text.trim()) &&
    typeof artifactData.correctAnswer === "string" &&
    Boolean(artifactData.correctAnswer.trim())
  );
}

export function calculateCourseProgress(
  modules: CourseProgressModule[] = [],
  progressRows: CourseProgressRow[] = [],
) {
  const availableModules = modules.filter(isCourseModuleAvailable);
  const completionByModuleId = new Map<string, boolean>();
  const updatedAtByModuleId = new Map<string, string>();

  for (const progress of progressRows) {
    const normalizedProgressId = normalizeId(progress.video_id);
    if (!normalizedProgressId) continue;

    const matchedModule = availableModules.find(
      (module) =>
        normalizeId(module.id) === normalizedProgressId ||
        normalizeId(module.video_cf_id) === normalizedProgressId,
    );

    if (!matchedModule) continue;

    const moduleId = String(matchedModule.id);
    const updatedAt = String(progress.updated_at || "");
    const previousUpdatedAt = updatedAtByModuleId.get(moduleId);

    if (!previousUpdatedAt || updatedAt >= previousUpdatedAt) {
      completionByModuleId.set(moduleId, Boolean(progress.completed));
      updatedAtByModuleId.set(moduleId, updatedAt);
    }
  }

  const completedModules = availableModules.filter((module) =>
    completionByModuleId.get(String(module.id)),
  ).length;
  const totalModules = availableModules.length;

  return {
    progressPercentage:
      totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
    completedModules,
    totalModules,
  };
}
