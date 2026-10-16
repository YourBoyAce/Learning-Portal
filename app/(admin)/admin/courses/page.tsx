"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Select from "react-select";
import { CourseCard } from "@/app/components/course";
import CourseCardSkeleton from "@/app/components/course/CourseCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  Upload,
  Users,
  Pencil,
  Check,
  HelpCircle,
  Eye,
  ChevronRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import CueCard from "@/app/components/course/CueCard";
interface Course {
  id: number | string;
  title: string;
  description: string;
  thumbnail_url?: string;
  created_at?: string;
  category?: string;
  course_type?: string;
  whatsapp_community_link?: string | null;
  assigned_mentors?: { full_name: string }[];
}

interface SelectOption {
  value: string;
  label: string;
}

interface Profile {
  id: string;
  email: string | null;
  full_name?: string | null;
  role?: string | null;
}

function getProfileDisplayName(user: Pick<Profile, "full_name" | "email">): string {
  const name = user.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Unknown user";
}

function buildScholarSelectOptions(profileUsers: Profile[], memberEmails: string[] = []): SelectOption[] {
  const map = new Map<string, SelectOption>();
  for (const u of profileUsers) {
    const role = u.role?.toLowerCase();
    if (role === "admin" || role === "instructor" || role === "mentor") continue;
    if (!u.email) continue;
    const v = u.email.trim().toLowerCase();
    map.set(v, { value: v, label: getProfileDisplayName(u) });
  }
  for (const email of memberEmails) {
    if (map.has(email)) continue;
    map.set(email, { value: email, label: email });
  }
  return Array.from(map.values());
}

function buildMentorSelectOptions(profileUsers: Profile[], mentorEmails: string[] = []): SelectOption[] {
  const map = new Map<string, SelectOption>();
  for (const u of profileUsers) {
    const role = u.role?.toLowerCase();
    if (role !== "instructor" && role !== "mentor") continue;
    if (!u.email) continue;
    const v = u.email.trim().toLowerCase();
    map.set(v, { value: v, label: getProfileDisplayName(u) });
  }
  for (const email of mentorEmails) {
    if (map.has(email)) continue;
    map.set(email, { value: email, label: email });
  }
  return Array.from(map.values());
}

function buildSelectedOptions(emails: string[], options: SelectOption[]): SelectOption[] {
  const optMap = new Map(options.map((o) => [o.value, o]));
  return emails.map((e) => optMap.get(e) ?? { value: e, label: e });
}

export default function AdminCourses() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<
    number | string | null
  >(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  interface ModuleQuestion {
    questionType?: "mc" | "text";
    text: string;
    options: string[];
    correctAnswer: number | string;
  }

  const [modules, setModules] = useState<
    Array<{ id?: string | number; title: string; description: string; module_type?: "video" | "quiz" | "artifact"; questions?: ModuleQuestion[]; section_id?: string | number | null }>
  >([]);

  // â”€â”€ Section state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  interface SectionState {
    id?: string | number;
    title: string;
    description: string;
    modules: Array<{ id?: string | number; title: string; description: string; module_type?: "video" | "quiz" | "artifact"; questions?: ModuleQuestion[] }>;
  }
  const [courseSections, setCourseSections] = useState<SectionState[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingArtifacts, setUploadingArtifacts] = useState<Record<string, boolean>>({});
  const [modalMessage, setModalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Active Question Index tracking for single-question navigation per module (key: module identifier string, value: question index number)
  const [activeQuestionIndices, setActiveQuestionIndices] = useState<Record<string, number>>({});

  const getActiveQIdx = (moduleKey: string, totalQuestions: number) => {
    const current = activeQuestionIndices[moduleKey] ?? 0;
    if (totalQuestions === 0) return 0;
    return Math.min(Math.max(0, current), totalQuestions - 1);
  };

  const setActiveQIdx = (moduleKey: string, idx: number) => {
    setActiveQuestionIndices((prev) => ({ ...prev, [moduleKey]: idx }));
  };
  const [previewQuizData, setPreviewQuizData] = useState<{
    title: string;
    questions: ModuleQuestion[];
  } | null>(null);
  const [previewQIdx, setPreviewQIdx] = useState(0);
  const [previewSelectedAnswer, setPreviewSelectedAnswer] = useState<number | string | null>(null);
  const [previewIsSubmitted, setPreviewIsSubmitted] = useState(false);
  const [previewScore, setPreviewScore] = useState(0);
  const [previewFinished, setPreviewFinished] = useState(false);

  const handleOpenQuizPreview = (title: string, questions?: ModuleQuestion[]) => {
    setPreviewQuizData({
      title: title.trim() || "Quiz Preview",
      questions: questions || [],
    });
    setPreviewQIdx(0);
    setPreviewSelectedAnswer(null);
    setPreviewIsSubmitted(false);
    setPreviewScore(0);
    setPreviewFinished(false);
  };

  const [whatsappLink, setWhatsappLink] = useState("");
  const [startDateField, setStartDateField] = useState("");

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // â”€â”€ Member/Mentor assignment state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [profileUsers, setProfileUsers] = useState<Profile[]>([]);
  const [scholarSelectOptions, setScholarSelectOptions] = useState<SelectOption[]>([]);
  const [mentorSelectOptions, setMentorSelectOptions] = useState<SelectOption[]>([]);
  const [selectedScholars, setSelectedScholars] = useState<readonly SelectOption[]>([]);
  const [selectedMentors, setSelectedMentors] = useState<readonly SelectOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        console.error("Auth error:", sessionError);
        return;
      }

      const response = await fetch("/api/admin/courses", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);

      if (response.ok && Array.isArray(result?.courses)) {
        setCourses(result.courses);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const resetActiveFields = () => {
    setCourseTitle("");
    setCourseDescription("");
    setThumbnailFile(null);
    setThumbnailPreview("");
    setStartDateField("");
    setWhatsappLink("");
    setSelectedScholars([]);
    setSelectedMentors([]);
    setScholarSelectOptions([]);
    setMentorSelectOptions([]);
    setIsLoadingMembers(false);
  };

  const handleCreateNew = () => {
    setIsEditing(false);
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setModules([]);
    setCourseSections([]);
    setThumbnailFile(null);
    setThumbnailPreview("");
    setModalMessage(null);
    resetActiveFields();
    setShowModal(true);

    // Fetch profile users for the member/mentor dropdowns
    void (async () => {
      try {
        setIsLoadingMembers(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.access_token) return;
        const res = await fetch("/api/admin/courses?includeMembers=true", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const result = await res.json().catch(() => null);
        if (res.ok && Array.isArray(result?.users)) {
          setProfileUsers(result.users);
          setScholarSelectOptions(buildScholarSelectOptions(result.users));
          setMentorSelectOptions(buildMentorSelectOptions(result.users));
        }
      } catch (e) {
        console.error("Failed to fetch profiles:", e);
      } finally {
        setIsLoadingMembers(false);
      }
    })();
  };

  const handleEdit = useCallback(async (course: Course) => {
    setIsEditing(true);
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDescription(course.description || "");
    setModules([]);
    setCourseSections([]);
    setThumbnailFile(null);
    setThumbnailPreview(course.thumbnail_url || "");
    setModalMessage(null);
    resetActiveFields();
    setSelectedScholars([]);
    setSelectedMentors([]);
    setScholarSelectOptions([]);
    setMentorSelectOptions([]);
    setIsLoadingMembers(true);

    setWhatsappLink(course.whatsapp_community_link || "");
    setShowModal(true);

    // Load existing modules
    try {
      const { data, error } = await supabase
        .from("coursemodules")
        .select("id, title, description, module_type, questions")
        .eq("maincourse_id", course.id)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (!error && data && data.length > 0) {
        setModules(
          data.map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description || "",
            module_type: m.module_type || "video",
            questions: Array.isArray(m.questions)
              ? m.questions
              : typeof m.questions === "string"
                ? JSON.parse(m.questions)
                : [],
            section_id: m.section_id || null,
          })),
        );
      }
    } catch (err) {
      console.error("Failed to fetch modules:", err);
    }

    // Also load sections
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return;

      const res = await fetch(
        `/api/admin/sections?courseId=${encodeURIComponent(String(course.id))}`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );
      const result = await res.json().catch(() => null);
      if (res.ok && Array.isArray(result?.sections)) {
        // Fetch modules to group into sections
        const { data: allModules } = await supabase
          .from("coursemodules")
          .select("id, title, description, module_type, questions, section_id")
          .eq("maincourse_id", course.id)
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });

        const sectionStates: SectionState[] = result.sections.map((sec: any) => ({
          id: sec.id,
          title: sec.title,
          description: sec.description || "",
          modules: (allModules || [])
            .filter((m: any) => String(m.section_id) === String(sec.id))
            .map((m: any) => ({
              id: m.id,
              title: m.title,
              description: m.description || "",
              module_type: m.module_type || "video",
              questions: Array.isArray(m.questions)
                ? m.questions
                : typeof m.questions === "string"
                  ? JSON.parse(m.questions)
                  : [],
            })),
        }));
        setCourseSections(sectionStates);
      }
    } catch (err) {
      console.error("Failed to fetch sections:", err);
    }

    // Fetch member/mentor assignments for this course
    try {
      setIsLoadingMembers(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return;

      const res = await fetch(
        `/api/admin/courses?includeMembers=true&courseId=${encodeURIComponent(String(course.id))}`,
        {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          cache: "no-store",
        },
      );
      const result = await res.json().catch(() => null);
      if (res.ok && Array.isArray(result?.users)) {
        const latestUsers = result.users as Profile[];
        setProfileUsers(latestUsers);

        const scholarEmails: string[] = result?.assignment?.scholarEmails ?? [];
        const mentorEmails: string[] = result?.assignment?.mentorEmails ?? [];

        const scholarOpts = buildScholarSelectOptions(latestUsers, scholarEmails);
        const mentorOpts = buildMentorSelectOptions(latestUsers, mentorEmails);

        setScholarSelectOptions(scholarOpts);
        setMentorSelectOptions(mentorOpts);
        setSelectedScholars(buildSelectedOptions(scholarEmails, scholarOpts));
        setSelectedMentors(buildSelectedOptions(mentorEmails, mentorOpts));
      }
    } catch (e) {
      console.error("Failed to fetch member assignments:", e);
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  const handleAddModule = () =>
    setModules([...modules, { title: "", description: "", module_type: "video", questions: [] }]);

  const handleModuleChange = (
    index: number,
    field: "title" | "description" | "module_type",
    value: string,
  ) => {
    const next = [...modules];
    next[index] = { ...next[index], [field]: value };
    setModules(next);
  };

  const handleRemoveModule = (index: number) =>
    setModules(modules.filter((_, i) => i !== index));

  const handleAddQuestionToFlatModule = (mIdx: number) => {
    const next = [...modules];
    const currentQuestions = next[mIdx].questions || [];
    next[mIdx] = {
      ...next[mIdx],
      questions: [
        ...currentQuestions,
        { questionType: "mc", text: "", options: ["", "", "", ""], correctAnswer: 0 },
      ],
    };
    setModules(next);
  };

  const handleRemoveQuestionFromFlatModule = (mIdx: number, qIdx: number) => {
    const next = [...modules];
    const currentQuestions = next[mIdx].questions || [];
    next[mIdx] = {
      ...next[mIdx],
      questions: currentQuestions.filter((_, i) => i !== qIdx),
    };
    setModules(next);
  };

  const handleFlatQuestionChange = (
    mIdx: number,
    qIdx: number,
    field: "text" | "correctAnswer" | "questionType",
    value: string | number,
  ) => {
    const next = [...modules];
    const questions = [...(next[mIdx].questions || [])];
    if (questions[qIdx]) {
      let updated = { ...questions[qIdx], [field]: value };
      if (field === "questionType" && value === "text" && typeof updated.correctAnswer === "number") {
        updated.correctAnswer = "";
      } else if (field === "questionType" && value === "mc" && typeof updated.correctAnswer === "string") {
        updated.correctAnswer = 0;
      }
      questions[qIdx] = updated;
      next[mIdx] = { ...next[mIdx], questions };
      setModules(next);
    }
  };

  const handleFlatOptionChange = (
    mIdx: number,
    qIdx: number,
    oIdx: number,
    value: string,
  ) => {
    const next = [...modules];
    const questions = [...(next[mIdx].questions || [])];
    if (questions[qIdx]) {
      const options = [...questions[qIdx].options];
      options[oIdx] = value;
      questions[qIdx] = { ...questions[qIdx], options };
      next[mIdx] = { ...next[mIdx], questions };
      setModules(next);
    }
  };

  // â”€â”€ Section handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleAddSection = (afterIndex?: number) => {
    const newSection: SectionState = { title: "", description: "", modules: [] };
    if (typeof afterIndex === "number" && afterIndex >= 0 && afterIndex < courseSections.length) {
      const next = [...courseSections];
      next.splice(afterIndex + 1, 0, newSection);
      setCourseSections(next);
    } else {
      setCourseSections([...courseSections, newSection]);
    }
  };

  const handleSectionChange = (
    sIdx: number,
    field: "title" | "description",
    value: string,
  ) => {
    const next = [...courseSections];
    next[sIdx] = { ...next[sIdx], [field]: value };
    setCourseSections(next);
  };

  const handleRemoveSection = (sIdx: number) =>
    setCourseSections(courseSections.filter((_, i) => i !== sIdx));

  const handleAddModuleToSection = (sIdx: number) => {
    const next = [...courseSections];
    next[sIdx] = {
      ...next[sIdx],
      modules: [...next[sIdx].modules, { title: "", description: "", module_type: "video", questions: [] }],
    };
    setCourseSections(next);
  };

  const handleSectionModuleChange = (
    sIdx: number,
    mIdx: number,
    field: "title" | "description" | "module_type",
    value: string,
  ) => {
    const next = [...courseSections];
    const mods = [...next[sIdx].modules];
    mods[mIdx] = { ...mods[mIdx], [field]: value };
    next[sIdx] = { ...next[sIdx], modules: mods };
    setCourseSections(next);
  };

  const handleAddQuestionToModule = (sIdx: number, mIdx: number) => {
    const next = [...courseSections];
    const mods = [...next[sIdx].modules];
    const currentQuestions = mods[mIdx].questions || [];
    mods[mIdx] = {
      ...mods[mIdx],
      questions: [
        ...currentQuestions,
        { questionType: "mc", text: "", options: ["", "", "", ""], correctAnswer: 0 },
      ],
    };
    next[sIdx] = { ...next[sIdx], modules: mods };
    setCourseSections(next);
  };

  const handleRemoveQuestionFromModule = (sIdx: number, mIdx: number, qIdx: number) => {
    const next = [...courseSections];
    const mods = [...next[sIdx].modules];
    const currentQuestions = mods[mIdx].questions || [];
    mods[mIdx] = {
      ...mods[mIdx],
      questions: currentQuestions.filter((_, i) => i !== qIdx),
    };
    next[sIdx] = { ...next[sIdx], modules: mods };
    setCourseSections(next);
  };

  const handleQuestionChange = (
    sIdx: number,
    mIdx: number,
    qIdx: number,
    field: "text" | "correctAnswer" | "questionType",
    value: string | number,
  ) => {
    const next = [...courseSections];
    const mods = [...next[sIdx].modules];
    const questions = [...(mods[mIdx].questions || [])];
    if (questions[qIdx]) {
      let updated = { ...questions[qIdx], [field]: value };
      if (field === "questionType" && value === "text" && typeof updated.correctAnswer === "number") {
        updated.correctAnswer = "";
      } else if (field === "questionType" && value === "mc" && typeof updated.correctAnswer === "string") {
        updated.correctAnswer = 0;
      }
      questions[qIdx] = updated;
      mods[mIdx] = { ...mods[mIdx], questions };
      next[sIdx] = { ...next[sIdx], modules: mods };
      setCourseSections(next);
    }
  };

  const handleOptionChange = (
    sIdx: number,
    mIdx: number,
    qIdx: number,
    oIdx: number,
    value: string,
  ) => {
    const next = [...courseSections];
    const mods = [...next[sIdx].modules];
    const questions = [...(mods[mIdx].questions || [])];
    if (questions[qIdx]) {
      const options = [...(questions[qIdx].options || ["", "", "", ""])];
      options[oIdx] = value;
      questions[qIdx] = { ...questions[qIdx], options };
      mods[mIdx] = { ...mods[mIdx], questions };
      next[sIdx] = { ...next[sIdx], modules: mods };
      setCourseSections(next);
    }
  };

  const handleRemoveSectionModule = (sIdx: number, mIdx: number) => {
    const next = [...courseSections];
    next[sIdx] = {
      ...next[sIdx],
      modules: next[sIdx].modules.filter((_, i) => i !== mIdx),
    };
    setCourseSections(next);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };


  const uploadThumbnail = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `course-thumbnails/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("course-thumbnails")
      .upload(fileName, file);
    if (error) return null;
    const { data: urlData } = supabase.storage
      .from("course-thumbnails")
      .getPublicUrl(fileName);
    return urlData.publicUrl ?? null;
  };

  // Artifact modules may be saved without a typed title; fall back to the file name
  const withArtifactTitle = <T extends { title: string; module_type?: string; questions?: ModuleQuestion[] }>(m: T): T => {
    if (m.title.trim() || m.module_type !== "artifact" || !m.questions?.length) return m;
    return { ...m, title: m.questions[0].options?.[0] || "Artifact" };
  };

  const handleSaveCourse = async () => {
    try {
      setIsSaving(true);
      setModalMessage(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      // Upload thumbnail if provided
      let thumbnailUrl: string | null | undefined;
      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail(thumbnailFile);
      } else if (isEditing && !thumbnailPreview) {
        thumbnailUrl = null;
      } else {
        thumbnailUrl = undefined;
      }

      if (!courseTitle.trim()) {
        setModalMessage({ type: "error", text: "Please enter a course title." });
        setIsSaving(false);
        return;
      }

      const body = {
        ...(isEditing && editingCourseId ? { id: editingCourseId } : {}),
        title: courseTitle.trim(),
        description: courseDescription.trim(),
        whatsapp_community_link: whatsappLink.trim() || null,
        ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
        // Send sections with nested modules if sections exist
        ...(courseSections.length > 0
          ? {
            sections: courseSections
              .filter((s) => s.title.trim())
              .map((s) => ({
                ...(s.id && { id: s.id }),
                title: s.title.trim(),
                description: s.description.trim(),
                modules: s.modules
                  .map(withArtifactTitle)
                  .filter((m) => m.title.trim())
                  .map((m) => ({
                    ...(m.id && { id: m.id }),
                    title: m.title.trim(),
                    description: m.description.trim(),
                    module_type: m.module_type || "video",
                    questions: Array.isArray(m.questions) ? m.questions : [],
                  })),
              })),
          }
          : {
            modules: modules
              .map(withArtifactTitle)
              .filter((m) => m.title.trim())
              .map((m) => ({
                ...(m.id && { id: m.id }),
                title: m.title.trim(),
                description: m.description.trim(),
                module_type: m.module_type || "video",
                questions: Array.isArray(m.questions) ? m.questions : [],
              })),
          }),
        // Members & Mentors
        assigned_scholars: selectedScholars.map((u) => u.value),
        assigned_mentors: selectedMentors.map((u) => u.value),
      };

      const res = await fetch("/api/admin/courses", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(result?.error || `Request failed (${res.status}).`);

      await fetchCourses();
      setShowModal(false);
      setCourseTitle("");
      setCourseDescription("");
      setModules([]);
      setCourseSections([]);
      setThumbnailFile(null);
      setThumbnailPreview("");
      setSelectedScholars([]);
      setSelectedMentors([]);
      setScholarSelectOptions([]);
      setMentorSelectOptions([]);
      resetActiveFields();
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };



  const handleDeleteClick = (course: Course) => {
    setModalMessage(null);
    setDeletingCourse(course);
    setShowDeleteConfirm(true);
  };

  useEffect(() => {
    const action = searchParams.get("action");
    const courseId = searchParams.get("courseId");

    if (!action || !courseId || loading) {
      return;
    }

    const course = courses.find((c) => String(c.id) === String(courseId));

    router.replace("/admin/courses", { scroll: false });

    if (!course) {
      return;
    }

    if (action === "edit") {
      void handleEdit(course);
    } else if (action === "delete") {
      handleDeleteClick(course);
    }
  }, [searchParams, courses, loading, router, handleEdit]);

  const handleConfirmDelete = async () => {
    if (!deletingCourse) return;

    try {
      setIsDeleting(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch(`/api/admin/courses?id=${deletingCourse.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          id: deletingCourse.id,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete.");
      }

      await fetchCourses();
      setShowDeleteConfirm(false);
      setDeletingCourse(null);
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCourses = courses
    .filter((course) =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

  const stats = [
    {
      label: "Total Courses",
      value: courses.length.toString(),
      icon: ICONS.BOOK,
    },
    {
      label: "Active Cohorts",
      value: courses.length.toString(),
      icon: ICONS.GLOBE,
    },
  ];

  const handleArtifactUpload = async (sIdx: number | null, mIdx: number, file: File) => {
    const uploadKey = sIdx !== null ? `sec_${sIdx}_${mIdx}` : `flat_${mIdx}`;
    try {
      setUploadingArtifacts(prev => ({ ...prev, [uploadKey]: true }));
      const uniqueFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `artifacts/${uniqueFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("course-artifacts")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
        
      if (uploadError) {
        setModalMessage({ type: "error", text: "Failed to upload artifact: " + uploadError.message });
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from("course-artifacts")
        .getPublicUrl(filePath);
        
      const fileUrl = publicUrlData.publicUrl;
      const artifactQuestion = {
        questionType: "text" as const,
        text: fileUrl, 
        options: [file.name, `${(file.size / (1024 * 1024)).toFixed(2)} MB`], 
        correctAnswer: filePath,
      };
      
      if (sIdx !== null) {
        setCourseSections((prev) => {
          const newSections = [...prev];
          const newSection = { ...newSections[sIdx] };
          const newModules = [...newSection.modules];
          const newModule = { ...newModules[mIdx] };
          newModule.questions = [artifactQuestion];
          newModules[mIdx] = newModule;
          newSection.modules = newModules;
          newSections[sIdx] = newSection;
          return newSections;
        });
      } else {
        setModules((prev) => {
          const newModules = [...prev];
          const newModule = { ...newModules[mIdx] };
          newModule.questions = [artifactQuestion];
          newModules[mIdx] = newModule;
          return newModules;
        });
      }
      setModalMessage({ type: "success", text: "Artifact uploaded successfully!" });
    } catch (err: any) {
      setModalMessage({ type: "error", text: err.message || "Failed to upload artifact." });
    } finally {
      setUploadingArtifacts(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>Manage Courses</h1>
            <p
              className={
                TYPOGRAPHY.BODY.fontSize +
                " " +
                TYPOGRAPHY.BODY.lineHeight +
                " " +
                TYPOGRAPHY.BODY.fontWeight +
                " text-gray-600"
              }
            >
              Create, edit, and publish your course catalog.
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Course
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4"
            >
              <div className="flex items-center justify-center shrink-0">
                <Image
                  src={stat.icon}
                  alt={stat.label}
                  width={30}
                  height={30}
                />
              </div>

              <div className="flex flex-col">
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: "var(--color-primary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.value}
                </span>

                <span
                  className="text-sm"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Course Catalog Header & Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Course Catalog</h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border text-gray-600 border-gray-200 rounded-xl text-sm bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-16">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} variant="admin" />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Upcoming Courses</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {[0, 1].map((i) => (
                  <CourseCardSkeleton key={i} variant="admin" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-900 font-bold mb-2">
              {searchTerm
                ? "No courses match your search"
                : "Your catalog is empty"}
            </p>
            {!searchTerm && (
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                Get started by creating your first course. You can add modules,
                descriptions, and publish it right away.
              </p>
            )}
            {!searchTerm && (
              <button
                onClick={handleCreateNew}
                className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create First Course
              </button>
            )}
          </div>
        )}

        {/* Course Cards Grid / Carousel */}
        {!loading && filteredCourses.length > 0 && (
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
                {filteredCourses.map((course) => (
                  <CarouselItem
                    key={course.id}
                    className="pl-4 sm:pl-6 basis-[85vw] sm:basis-1/2 lg:basis-1/2 xl:basis-1/3"
                  >
                    <CourseCard
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnail={course.thumbnail_url}
                      courseStatus="active"
                      variant="admin"
                      onClick={() =>
                        router.push(`/admin/courses/${course.id}`)
                      }
                      onEdit={() => handleEdit(course)}
                      onDelete={() => handleDeleteClick(course)}
                      assignedMentors={course.assigned_mentors}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>

              {filteredCourses.length > 3 && (
                <>
                  <CarouselPrevious className="flex left-2 lg:-left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                  <CarouselNext className="flex right-2 lg:-right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                </>
              )}
            </Carousel>
          </div>
        )}
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CREATE / EDIT MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                {isEditing ? "Edit Course" : "Create New Course"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Course Title */}
              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Playwright"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 placeholder:text-gray-400 placeholder:font-normal font-medium"
                />
              </div>

              {/* Course Description */}
              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                  Description
                </label>
                <textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe what students will learn in this course..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-brand-primary resize-none"
                />
              </div>

              {/* Assign Scholars */}
              <div>
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                  <Users size={14} /> Assign Scholars
                </label>
                <Select
                  isMulti
                  options={scholarSelectOptions}
                  value={selectedScholars}
                  onChange={(v) => setSelectedScholars((v ?? []) as readonly SelectOption[])}
                  placeholder="Select scholars..."
                  isLoading={isLoadingMembers}
                  isDisabled={isLoadingMembers}
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: "#e5e7eb",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      minHeight: "42px",
                      boxShadow: "none",
                      "&:hover": { borderColor: "#d1d5db" },
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "#eff6ff",
                      borderRadius: "9999px",
                      border: "1px solid #bfdbfe",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#1e40af",
                      fontWeight: 600,
                      fontSize: "11px",
                      padding: "2px 6px",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "#93c5fd",
                      "&:hover": { backgroundColor: "#dbeafe", color: "#1d4ed8" },
                    }),
                    placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: "0.875rem" }),
                    menu: (base) => ({ ...base, borderRadius: "0.75rem", overflow: "hidden" }),
                  }}
                />
              </div>

              {/* Assign Mentors / Instructors */}
              <div>
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                  <Users size={14} className="text-purple-500" /> Assign Mentors / Instructors
                </label>
                <Select
                  isMulti
                  options={mentorSelectOptions}
                  value={selectedMentors}
                  onChange={(v) => setSelectedMentors((v ?? []) as readonly SelectOption[])}
                  placeholder="Select mentors..."
                  isLoading={isLoadingMembers}
                  isDisabled={isLoadingMembers}
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: "#e5e7eb",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      minHeight: "42px",
                      boxShadow: "none",
                      "&:hover": { borderColor: "#d1d5db" },
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "#faf5ff",
                      borderRadius: "9999px",
                      border: "1px solid #e9d5ff",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#7e22ce",
                      fontWeight: 600,
                      fontSize: "11px",
                      padding: "2px 6px",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "#c084fc",
                      "&:hover": { backgroundColor: "#f3e8ff", color: "#7e22ce" },
                    }),
                    placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: "0.875rem" }),
                    menu: (base) => ({ ...base, borderRadius: "0.75rem", overflow: "hidden" }),
                  }}
                />
              </div>

              {/* Course Thumbnail */}
              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                  Course Thumbnail
                </label>
                {thumbnailPreview ? (
                  <label className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 group block cursor-pointer bg-gray-50">
                    <Image
                      src={thumbnailPreview}
                      alt="Course Thumbnail"
                      fill
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <span className="bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors shadow-sm">
                        Change Thumbnail
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setThumbnailFile(null);
                          setThumbnailPreview("");
                        }}
                        className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors shadow-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-all group">
                    <Upload className="w-8 h-8 text-gray-300 group-hover:text-brand-primary transition-colors mb-2" />
                    <span className="text-xs text-gray-400 group-hover:text-brand-primary font-medium">
                      Click to upload thumbnail
                    </span>
                    <span className="text-[10px] text-gray-300 mt-1">
                      PNG, JPG up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

                  {/* Start Date */}
                  <div>
                    <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={startDateField}
                      onChange={(e) => setStartDateField(e.target.value)}
                      className="w-full bg-[#1682F1]/10 border border-[#1682F1]/20 rounded-xl px-4 py-3 text-sm text-[#174778] font-medium outline-none focus:border-[#1682F1] focus:ring-2 focus:ring-[#1682F1]/20 transition-all cursor-pointer"
                    />
                  </div>

                  {/* WhatsApp Community Link */}
                  <div>
                    <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                      WhatsApp Community Link (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      value={whatsappLink}
                      onChange={(e) => setWhatsappLink(e.target.value)}
                      className="w-full bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl px-4 py-3 text-sm text-gray-700 font-medium outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 transition-all placeholder:font-normal placeholder:text-gray-400"
                    />
                  </div>

                  {/* Sections & Modules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                        Sections & Modules
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddSection()}
                          className="text-brand-primary hover:bg-brand-primary/10 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Section
                        </button>
                        {courseSections.length === 0 && (
                          <button
                            type="button"
                            onClick={handleAddModule}
                            className="text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add Module
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sections */}
                    {courseSections.map((section, sIdx) => (
                      <div
                        key={sIdx}
                        className="border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 bg-slate-50/90 shadow-sm border-l-4 border-l-brand-primary transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-brand-primary text-white rounded-lg flex items-center justify-center shrink-0 font-extrabold text-xs shadow-2xs">
                            {sIdx + 1}
                          </div>
                          <input
                            type="text"
                            placeholder={`Section ${sIdx + 1} Title (e.g. Introduction)`}
                            value={section.title}
                            onChange={(e) =>
                              handleSectionChange(sIdx, "title", e.target.value)
                            }
                            className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white shadow-2xs placeholder:font-normal"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sIdx)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Remove section"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          placeholder="Section description (optional)"
                          value={section.description}
                          onChange={(e) =>
                            handleSectionChange(sIdx, "description", e.target.value)
                          }
                          rows={2}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none bg-white"
                        />

                        {/* Modules within section */}
                        <div className="pl-3 sm:pl-4 border-l-2 border-slate-300 space-y-3">
                          {section.modules.map((mod, mIdx) => (
                            <div
                              key={mIdx}
                              className="border-2 border-gray-200/90 rounded-xl p-3.5 space-y-2.5 bg-white shadow-xs hover:shadow-md hover:border-gray-300 transition-all"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-slate-100 text-slate-900 rounded-md flex items-center justify-center shrink-0 border border-slate-300 font-bold text-[11px]">
                                  {mIdx + 1}
                                </div>
                                <input
                                  type="text"
                                  placeholder={`Module ${mIdx + 1} Title`}
                                  value={mod.title}
                                  onChange={(e) =>
                                    handleSectionModuleChange(
                                      sIdx,
                                      mIdx,
                                      "title",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-gray-50/40 focus:bg-white placeholder:font-normal"
                                />

                                {/* Module Type Selector (Top Right of Module Section) */}
                                <div className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1 border transition-colors ${mod.module_type === "quiz" ? "bg-amber-50 border-amber-300 text-amber-900 font-bold" : mod.module_type === "artifact" ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                                  }`}>
                                  <select
                                    value={mod.module_type || "video"}
                                    onChange={(e) =>
                                      handleSectionModuleChange(
                                        sIdx,
                                        mIdx,
                                        "module_type",
                                        e.target.value,
                                      )
                                    }
                                    className="text-[11px] font-bold bg-transparent focus:outline-none cursor-pointer"
                                    title="Module Type"
                                  >
                                    <option value="video">Video</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="artifact">Artifact</option>
                                  </select>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveSectionModule(sIdx, mIdx)
                                  }
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {mod.module_type === "quiz" ? (
                                <div className="space-y-3 pt-3 border-t-2 border-slate-200 bg-slate-50/90 rounded-b-xl p-3.5 -mx-3.5 -mb-3.5">
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1">
                                      <HelpCircle size={12} className="text-gray-700" /> Quiz Questions & Answers ({mod.questions?.length || 0})
                                    </span>
                                  </div>

                                  {(!mod.questions || mod.questions.length === 0) ? (
                                    <div className="text-center py-3 px-2 border border-dashed border-gray-300 rounded-lg bg-white">
                                      <p className="text-xs text-gray-800 font-semibold">No questions added yet.</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5 mb-2">Click &quot;Add Question&quot; to add questions for this quiz module.</p>
                                      <button
                                        type="button"
                                        onClick={() => handleAddQuestionToModule(sIdx, mIdx)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
                                      >
                                        <Plus size={13} /> Add Question
                                      </button>
                                    </div>
                                  ) : (() => {
                                    const moduleKey = `sec_${sIdx}_${mIdx}`;
                                    const totalQ = mod.questions.length;
                                    const currentQIdx = getActiveQIdx(moduleKey, totalQ);
                                    const q = mod.questions[currentQIdx] || mod.questions[0];

                                    return (
                                      <div className="space-y-3">
                                        {/* Question Card */}
                                        {q && (
                                          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 shadow-2xs">
                                            {/* Header with question number, type, +, trash, eye */}
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                                                  Question {currentQIdx + 1} / {totalQ}
                                                </span>
                                                <select
                                                  value={q.questionType || "mc"}
                                                  onChange={(e) => handleQuestionChange(sIdx, mIdx, currentQIdx, "questionType", e.target.value)}
                                                  className="text-[10px] font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer shrink-0 max-w-[140px] sm:max-w-none"
                                                >
                                                  <option value="mc">Multiple Choice</option>
                                                  <option value="text">Fill in the Blank (Text)</option>
                                                </select>
                                              </div>

                                              {/* Action symbols: +, trash, eye */}
                                              <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleAddQuestionToModule(sIdx, mIdx);
                                                    setActiveQIdx(moduleKey, totalQ);
                                                  }}
                                                  className="p-1.5 text-gray-700 hover:text-brand-primary hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                                                  title="Add New Question"
                                                >
                                                  <Plus size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenQuizPreview(mod.title || `Module ${mIdx + 1}`, mod.questions)}
                                                  className="p-1.5 text-gray-700 hover:text-brand-primary hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                                                  title="Preview Quiz"
                                                >
                                                  <Eye size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleRemoveQuestionFromModule(sIdx, mIdx, currentQIdx);
                                                    if (currentQIdx > 0) {
                                                      setActiveQIdx(moduleKey, currentQIdx - 1);
                                                    }
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-gray-200"
                                                  title="Delete Current Question"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Question Text Input */}
                                            <input
                                              type="text"
                                              placeholder={`Question ${currentQIdx + 1} text...`}
                                              value={q.text}
                                              onChange={(e) => handleQuestionChange(sIdx, mIdx, currentQIdx, "text", e.target.value)}
                                              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:border-gray-900 font-medium bg-white"
                                            />

                                            {/* Question Answers/Options */}
                                            {q.questionType === "text" ? (
                                              <div className="space-y-1 pt-1">
                                                <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider block">
                                                  Correct Text Answer (Fill in the Blank)
                                                </label>
                                                <input
                                                  type="text"
                                                  placeholder="Type exact correct answer..."
                                                  value={String(q.correctAnswer ?? "")}
                                                  onChange={(e) => handleQuestionChange(sIdx, mIdx, currentQIdx, "correctAnswer", e.target.value)}
                                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-900"
                                                />
                                              </div>
                                            ) : (
                                              <div className="space-y-1.5 pt-1">
                                                <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider block">
                                                  Options (Select radio for correct answer)
                                                </label>
                                                <div className="space-y-2">
                                                  {(q.options || ["", "", "", ""]).map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-center gap-2 w-full">
                                                      <input
                                                        type="radio"
                                                        name={`correct_${sIdx}_${mIdx}_${currentQIdx}`}
                                                        checked={q.correctAnswer === oIdx}
                                                        onChange={() => handleQuestionChange(sIdx, mIdx, currentQIdx, "correctAnswer", oIdx)}
                                                        className="accent-black cursor-pointer shrink-0 w-4 h-4"
                                                        title="Mark as correct answer"
                                                      />
                                                      <input
                                                        type="text"
                                                        placeholder={`Option ${oIdx + 1}`}
                                                        value={opt}
                                                        onChange={(e) => handleOptionChange(sIdx, mIdx, currentQIdx, oIdx, e.target.value)}
                                                        className={`flex-1 min-w-0 w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none transition-colors ${
                                                          q.correctAnswer === oIdx
                                                            ? "border-gray-900 bg-gray-100 font-semibold text-gray-900"
                                                            : "border-gray-200 text-gray-800 bg-white"
                                                        }`}
                                                      />
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Question Navigation Controls Bar */}
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                                          <button
                                            type="button"
                                            disabled={currentQIdx === 0}
                                            onClick={() => setActiveQIdx(moduleKey, currentQIdx - 1)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-800 border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                          >
                                            Previous Question
                                          </button>
                                          {currentQIdx < totalQ - 1 ? (
                                            <button
                                              type="button"
                                              onClick={() => setActiveQIdx(moduleKey, currentQIdx + 1)}
                                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
                                            >
                                              Next Question
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleAddQuestionToModule(sIdx, mIdx);
                                                setActiveQIdx(moduleKey, totalQ);
                                              }}
                                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-primary hover:bg-brand-hover transition-colors flex items-center gap-1"
                                            >
                                              <Plus size={13} /> Add Question
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : mod.module_type === "artifact" ? (
                                <div className="space-y-3 pt-3 border-t-2 border-slate-200 bg-slate-50/90 rounded-b-xl p-3.5 -mx-3.5 -mb-3.5">
                                  {uploadingArtifacts[`sec_${sIdx}_${mIdx}`] ? (
                                    <div className="text-center py-5 px-3 border border-gray-200 rounded-lg bg-white shadow-2xs">
                                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                                      <p className="text-xs font-semibold text-gray-700">Uploading Artifact...</p>
                                    </div>
                                  ) : mod.questions && mod.questions.length > 0 ? (
                                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 shadow-2xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center shrink-0">
                                          <Upload size={16} />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-gray-900 truncate">{mod.questions[0].options?.[0] || "Artifact"}</p>
                                          <p className="text-[10px] text-gray-500">{mod.questions[0].options?.[1] || "Uploaded"}</p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCourseSections(prev => {
                                            const nw = [...prev];
                                            nw[sIdx].modules[mIdx].questions = [];
                                            return nw;
                                          });
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-gray-200 bg-white shadow-xs"
                                        title="Remove Artifact"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-center py-4 px-3 border border-dashed border-gray-300 rounded-lg bg-white">
                                      <label className="flex flex-col items-center justify-center cursor-pointer group">
                                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-colors mb-2">
                                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-500" />
                                        </div>
                                        <p className="text-xs text-gray-800 font-semibold group-hover:text-emerald-600 transition-colors">Click to upload artifact file</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">PDF, ZIP, Code, etc.</p>
                                        <input
                                          type="file"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleArtifactUpload(sIdx, mIdx, file);
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <textarea
                                  placeholder="Module description (optional)"
                                  value={mod.description}
                                  onChange={(e) =>
                                    handleSectionModuleChange(
                                      sIdx,
                                      mIdx,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  rows={1}
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-[11px] text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none bg-white"
                                />
                              )}
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => handleAddModuleToSection(sIdx)}
                              className="text-brand-primary hover:bg-brand-primary/10 px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add Module
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddSection(sIdx)}
                              className="text-brand-primary hover:bg-brand-primary/10 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors bg-white border border-brand-primary/20 shadow-xs hover:border-brand-primary/40 cursor-pointer"
                              title={`Add new section after Section ${sIdx + 1}`}
                            >
                              <Plus className="w-3 h-3 text-brand-primary" /> Add Section
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Ungrouped modules (when no sections, or legacy) */}
                    {courseSections.length === 0 && modules.map((module, index) => (
                      <div
                        key={index}
                        className="border-2 border-slate-300 rounded-xl p-4 space-y-3 bg-white shadow-sm hover:shadow-md transition-all border-l-4 border-l-brand-primary"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 text-slate-900 rounded-md flex items-center justify-center shrink-0 border border-slate-300 font-bold text-[11px]">
                            {index + 1}
                          </div>
                          <input
                            type="text"
                            placeholder={`Module ${index + 1} Title`}
                            value={module.title}
                            onChange={(e) =>
                              handleModuleChange(index, "title", e.target.value)
                            }
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-gray-50/40 focus:bg-white font-semibold"
                          />

                          {/* Module Type Selector */}
                          <div className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-colors ${module.module_type === "quiz" ? "bg-amber-50 border-amber-300 text-amber-900 font-bold" : module.module_type === "artifact" ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                            }`}>
                            <select
                              value={module.module_type || "video"}
                              onChange={(e) =>
                                handleModuleChange(index, "module_type", e.target.value)
                              }
                              className="text-xs font-bold bg-transparent focus:outline-none cursor-pointer"
                            >
                              <option value="video">Video</option>
                              <option value="quiz">Quiz</option>
                              <option value="artifact">Artifact</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveModule(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {module.module_type === "quiz" ? (
                          <div className="space-y-3 pt-3 border-t-2 border-slate-200 bg-slate-50/90 rounded-b-xl p-3.5 -mx-4 -mb-4">
                            <div className="flex items-center justify-between pb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1">
                                <HelpCircle size={12} className="text-gray-700" /> Quiz Questions & Answers ({module.questions?.length || 0})
                              </span>
                            </div>

                            {(!module.questions || module.questions.length === 0) ? (
                              <div className="text-center py-4 px-3 border border-dashed border-gray-300 rounded-lg bg-white">
                                <p className="text-xs text-gray-800 font-semibold">No questions added yet.</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 mb-3">Click &quot;Add Question&quot; to start adding questions for this quiz module.</p>
                                <button
                                  type="button"
                                  onClick={() => handleAddQuestionToFlatModule(index)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <Plus size={13} /> Add Question
                                </button>
                              </div>
                            ) : (
                              (() => {
                                const moduleKey = `flat_${index}`;
                                const totalQ = module.questions.length;
                                const currentQIdx = getActiveQIdx(moduleKey, totalQ);
                                const q = module.questions[currentQIdx] || module.questions[0];

                                return (
                                  <div className="space-y-3">
                                    {/* Question Card */}
                                    {q && (
                                      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 shadow-2xs">
                                        {/* Header with question number, type, +, trash, eye */}
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                                              Question {currentQIdx + 1} / {totalQ}
                                            </span>
                                            <select
                                              value={q.questionType || "mc"}
                                              onChange={(e) => handleFlatQuestionChange(index, currentQIdx, "questionType", e.target.value)}
                                              className="text-[10px] font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer shrink-0 max-w-[140px] sm:max-w-none"
                                            >
                                              <option value="mc">Multiple Choice</option>
                                              <option value="text">Fill in the Blank (Text)</option>
                                            </select>
                                          </div>

                                          {/* Action symbols: +, trash, eye */}
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleAddQuestionToFlatModule(index);
                                                setActiveQIdx(moduleKey, totalQ);
                                              }}
                                              className="p-1.5 text-gray-700 hover:text-brand-primary hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                                              title="Add New Question"
                                            >
                                              <Plus size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenQuizPreview(module.title || `Module ${index + 1}`, module.questions)}
                                              className="p-1.5 text-gray-700 hover:text-brand-primary hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
                                              title="Preview Quiz"
                                            >
                                              <Eye size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleRemoveQuestionFromFlatModule(index, currentQIdx);
                                                if (currentQIdx > 0) {
                                                  setActiveQIdx(moduleKey, currentQIdx - 1);
                                                }
                                              }}
                                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-gray-200"
                                              title="Delete Current Question"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Question Text Input */}
                                        <input
                                          type="text"
                                          placeholder={`Question ${currentQIdx + 1} text...`}
                                          value={q.text}
                                          onChange={(e) => handleFlatQuestionChange(index, currentQIdx, "text", e.target.value)}
                                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:border-gray-900 font-medium bg-white"
                                        />

                                        {/* Question Answers/Options */}
                                        {q.questionType === "text" ? (
                                          <div className="space-y-1 pt-1">
                                            <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider block">
                                              Correct Text Answer (Fill in the Blank)
                                            </label>
                                            <input
                                              type="text"
                                              placeholder="Type exact correct answer..."
                                              value={String(q.correctAnswer ?? "")}
                                              onChange={(e) => handleFlatQuestionChange(index, currentQIdx, "correctAnswer", e.target.value)}
                                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-900 bg-gray-50 focus:outline-none focus:border-gray-900"
                                            />
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5 pt-1">
                                            <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider block">
                                              Options (Select radio for correct answer)
                                            </label>
                                            <div className="space-y-2">
                                              {(q.options || ["", "", "", ""]).map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-2 w-full">
                                                  <input
                                                    type="radio"
                                                    name={`correct_flat_${index}_${currentQIdx}`}
                                                    checked={q.correctAnswer === oIdx}
                                                    onChange={() => handleFlatQuestionChange(index, currentQIdx, "correctAnswer", oIdx)}
                                                    className="accent-black cursor-pointer shrink-0 w-4 h-4"
                                                    title="Mark as correct answer"
                                                  />
                                                  <input
                                                    type="text"
                                                    placeholder={`Option ${oIdx + 1}`}
                                                    value={opt}
                                                    onChange={(e) => handleFlatOptionChange(index, currentQIdx, oIdx, e.target.value)}
                                                    className={`flex-1 min-w-0 w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none transition-colors ${
                                                      q.correctAnswer === oIdx
                                                        ? "border-gray-900 bg-gray-100 font-semibold text-gray-900"
                                                        : "border-gray-200 text-gray-800 bg-white"
                                                    }`}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Question Navigation Controls Bar */}
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                                      <button
                                        type="button"
                                        disabled={currentQIdx === 0}
                                        onClick={() => setActiveQIdx(moduleKey, currentQIdx - 1)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-800 border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                      >
                                        Previous Question
                                      </button>
                                      {currentQIdx < totalQ - 1 ? (
                                        <button
                                          type="button"
                                          onClick={() => setActiveQIdx(moduleKey, currentQIdx + 1)}
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
                                        >
                                          Next Question
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleAddQuestionToFlatModule(index);
                                            setActiveQIdx(moduleKey, totalQ);
                                          }}
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-primary hover:bg-brand-hover transition-colors flex items-center gap-1"
                                        >
                                          <Plus size={13} /> Add Question
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        ) : module.module_type === "artifact" ? (
                          <div className="space-y-3 pt-3 border-t-2 border-slate-200 bg-slate-50/90 rounded-b-xl p-3.5 -mx-4 -mb-4">
                            {uploadingArtifacts[`flat_${index}`] ? (
                              <div className="text-center py-5 px-3 border border-gray-200 rounded-lg bg-white shadow-2xs">
                                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                                <p className="text-xs font-semibold text-gray-700">Uploading Artifact...</p>
                              </div>
                            ) : module.questions && module.questions.length > 0 ? (
                              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 shadow-2xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center shrink-0">
                                    <Upload size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate">{module.questions[0].options?.[0] || "Artifact"}</p>
                                    <p className="text-[10px] text-gray-500">{module.questions[0].options?.[1] || "Uploaded"}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModules(prev => {
                                      const nw = [...prev];
                                      nw[index].questions = [];
                                      return nw;
                                    });
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-gray-200 bg-white shadow-xs"
                                  title="Remove Artifact"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-4 px-3 border border-dashed border-gray-300 rounded-lg bg-white">
                                <label className="flex flex-col items-center justify-center cursor-pointer group">
                                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-colors mb-2">
                                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-500" />
                                  </div>
                                  <p className="text-xs text-gray-800 font-semibold group-hover:text-emerald-600 transition-colors">Click to upload artifact file</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">PDF, ZIP, Code, etc.</p>
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleArtifactUpload(null, index, file);
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        ) : (
                          <textarea
                            placeholder={`Description for Module ${index + 1} (optional)`}
                            value={module.description}
                            onChange={(e) =>
                              handleModuleChange(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none bg-white"
                          />
                        )}
                      </div>
                    ))}
                    {courseSections.length === 0 && modules.length === 0 && (
                      <p className="text-xs text-gray-400 font-light">
                        No sections or modules yet.
                      </p>
                    )}
                  </div>


              {modalMessage && (
                <p
                  className={`text-xs font-medium ${modalMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}
                >
                  {modalMessage.text}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                disabled={isSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ DELETE CONFIRMATION MODAL Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showDeleteConfirm && deletingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Delete Course
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">
                  {deletingCourse.title}
                </strong>
                ? This action cannot be undone.
              </p>
              {modalMessage?.type === "error" && (
                <p className="text-xs text-red-600 text-center mt-3 font-medium">
                  {modalMessage.text}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingCourse(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* â”€â”€â”€ QUIZ PREVIEW MODAL POPUP (ENLARGED & PROMINENT) â”€â”€â”€ */}
      {previewQuizData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="px-8 py-5 bg-[#0B1527] text-white flex items-center justify-between border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-brand-primary/20 rounded-xl text-brand-primary border border-brand-primary/30">
                  <HelpCircle size={22} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-brand-primary tracking-widest uppercase block mb-0.5">Quiz Live Preview</span>
                  <h3 className="text-xl font-bold leading-tight text-white">{previewQuizData.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewQuizData(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Close Preview"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto flex-1 bg-gray-50/60">
              {previewQuizData.questions.length === 0 ? (
                <div className="text-center py-16 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
                  <p className="text-base font-semibold text-gray-700">No questions added yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Add questions to this quiz module to preview them here.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden max-w-4xl mx-auto">
                  {/* Card Header matching exact course quiz card theme */}
                  <div className="p-8 sm:p-10 bg-gradient-to-br from-[#0F1E3B] via-[#0F1E3B] to-[#162B50] text-white">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-sm font-semibold px-4 py-1.5 bg-brand-primary/20 text-brand-primary border border-brand-primary/30 rounded-full">
                        Question {previewQIdx + 1} of {previewQuizData.questions.length}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-300 font-medium bg-white/10 px-3 py-1 rounded-full">Interactive Preview Mode</span>
                    </div>
                    <h4 className="text-xl sm:text-2xl font-bold leading-relaxed text-white tracking-tight">
                      {previewQuizData.questions[previewQIdx]?.text || "Untitled Question"}
                    </h4>
                  </div>

                  {/* Questions area */}
                  <div className="p-8 sm:p-10 space-y-6 bg-white">
                    {previewQuizData.questions[previewQIdx]?.questionType === "text" ? (
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                          Type your answer:
                        </label>
                        <input
                          type="text"
                          value={String(previewSelectedAnswer ?? "")}
                          onChange={(e) => {
                            if (!previewIsSubmitted) {
                              setPreviewSelectedAnswer(e.target.value);
                            }
                          }}
                          disabled={previewIsSubmitted}
                          placeholder="Enter your answer..."
                          className="w-full px-5 py-4 border-2 border-gray-300 rounded-2xl text-base font-semibold text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white disabled:bg-gray-50 transition-all"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3.5">
                        {(previewQuizData.questions[previewQIdx]?.options || []).map((opt, oIdx) => {
                          if (!opt && previewQuizData.questions[previewQIdx]?.options?.every(o => !o)) return null;
                          const isSelected = previewSelectedAnswer === oIdx;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => {
                                if (!previewIsSubmitted) {
                                  setPreviewSelectedAnswer(oIdx);
                                }
                              }}
                              disabled={previewIsSubmitted}
                              className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 text-base sm:text-lg transition-all flex items-center gap-4 cursor-pointer ${isSelected
                                ? "border-brand-primary bg-brand-primary/5 text-brand-primary font-bold shadow-sm"
                                : "border-gray-200 hover:border-gray-300 text-gray-800 bg-white hover:bg-gray-50/80"
                                }`}
                            >
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-brand-primary bg-brand-primary text-white" : "border-gray-300"
                                }`}>
                                {isSelected && <Check size={14} className="stroke-[3]" />}
                              </div>
                              <span className="font-semibold">{opt || `Option ${oIdx + 1}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Feedback box if submitted */}
                    {previewIsSubmitted && (
                      <div className={`p-5 rounded-2xl text-sm sm:text-base font-semibold border-2 animate-in fade-in duration-150 ${(() => {
                        const q = previewQuizData.questions[previewQIdx];
                        let isCorrect = false;
                        if (q?.questionType === "text") {
                          isCorrect = String(previewSelectedAnswer || "").trim().toLowerCase() === String(q.correctAnswer || "").trim().toLowerCase();
                        } else {
                          isCorrect = Number(previewSelectedAnswer) === Number(q.correctAnswer);
                        }
                        return isCorrect ? "bg-emerald-50 text-emerald-900 border-emerald-300" : "bg-red-50 text-red-900 border-red-300";
                      })()
                        }`}>
                        {(() => {
                          const q = previewQuizData.questions[previewQIdx];
                          let isCorrect = false;
                          if (q?.questionType === "text") {
                            isCorrect = String(previewSelectedAnswer || "").trim().toLowerCase() === String(q.correctAnswer || "").trim().toLowerCase();
                          } else {
                            isCorrect = Number(previewSelectedAnswer) === Number(q.correctAnswer);
                          }
                          return isCorrect ? (
                            <p className="flex items-center gap-2 font-bold text-emerald-800">
                              <Check size={18} className="stroke-[3]" /> Correct answer!
                            </p>
                          ) : (
                            <p className="flex items-center gap-2 font-bold text-red-800">
                              Incorrect! Correct answer: {q?.questionType === "text" ? String(q.correctAnswer) : q?.options?.[Number(q.correctAnswer)] || `Option ${Number(q.correctAnswer) + 1}`}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Footer with Submit / Next Button */}
                  <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">
                      {previewFinished
                        ? `Completed - Final Score: ${previewScore}/${previewQuizData.questions.length}`
                        : `Current Score: ${previewScore}`}
                    </span>

                    {!previewFinished && (
                      <div>
                        {!previewIsSubmitted ? (
                          <button
                            type="button"
                            disabled={previewSelectedAnswer === null || previewSelectedAnswer === ""}
                            onClick={() => {
                              const q = previewQuizData.questions[previewQIdx];
                              let isCorrect = false;
                              if (q?.questionType === "text") {
                                isCorrect = String(previewSelectedAnswer || "").trim().toLowerCase() === String(q.correctAnswer || "").trim().toLowerCase();
                              } else {
                                isCorrect = Number(previewSelectedAnswer) === Number(q.correctAnswer);
                              }
                              if (isCorrect) {
                                setPreviewScore((prev) => prev + 1);
                              }
                              setPreviewIsSubmitted(true);
                            }}
                            className="px-7 py-3 text-sm font-bold text-white bg-brand-primary hover:bg-brand-hover rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-md"
                          >
                            Submit Answer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (previewQIdx < previewQuizData.questions.length - 1) {
                                setPreviewQIdx((prev) => prev + 1);
                                setPreviewSelectedAnswer(null);
                                setPreviewIsSubmitted(false);
                              } else {
                                setPreviewFinished(true);
                              }
                            }}
                            className="px-7 py-3 text-sm font-bold text-white bg-brand-primary hover:bg-brand-hover rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                          >
                            {previewQIdx < previewQuizData.questions.length - 1 ? (
                              <>
                                Next Question <ChevronRight size={16} />
                              </>
                            ) : (
                              "Finish Preview"
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPreviewQIdx(0);
                  setPreviewSelectedAnswer(null);
                  setPreviewIsSubmitted(false);
                  setPreviewScore(0);
                  setPreviewFinished(false);
                }}
                className="text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 underline cursor-pointer"
              >
                Reset Preview Progress
              </button>
              <button
                type="button"
                onClick={() => setPreviewQuizData(null)}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
