"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  // Joined from profiles
  full_name: string | null;
  role?: string | null;
}

export interface MentionablePerson {
  id: string;
  full_name: string;
  role: string;
}

export type FetchMessagesError = { type: "NOT_ENROLLED" | "ERROR"; message: string };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Derives the securely authenticated user ID from the access token.
 */
async function getSecureUserId(accessToken: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await authClient.auth.getUser(accessToken);
    if (error || !user) return null;
    return user.id;
  } catch (error) {
    return null;
  }
}

/**
 * Verifies whether a user (by userId) is enrolled in a course via the
 * batch_members → batches relationship.
 * Mirrors the same lookup used in the course page and sendCourseMessage.
 */
async function checkEnrollment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (userError || !userData?.user) return false;

  // Admin bypass
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  if (profile?.role && profile.role.toLowerCase() === "admin") {
    return true;
  }

  // Check phase2.enrollments
  const { data: memberRows, error: memberError } = await supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("course_id, users!inner(auth_user_id)")
    .eq("users.auth_user_id", userId)
    .eq("course_id", courseId)
    .eq("status", "active");

  if (!memberError && (memberRows ?? []).length > 0) {
    return true;
  }

  // Check course_members for mentors/instructors
  if (profile?.email) {
    const { data: courseMemberRows, error: courseMemberError } = await supabaseAdmin
      .from("course_members")
      .select("maincourse_id")
      .eq("email", profile.email)
      .eq("maincourse_id", courseId)
      .eq("status", "active");
      
    if (!courseMemberError && (courseMemberRows ?? []).length > 0) {
      return true;
    }
  }

  return false;
}

async function hydrateMessagesWithProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  messages: any[],
): Promise<ChatMessage[]> {
  if (!messages || messages.length === 0) return [];

  const userIds = Array.from(new Set(messages.map((m) => m.user_id)));

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .in("id", userIds);

  const profileMap = new Map<string, { full_name: string | null, role: string | null }>(
    (profiles ?? []).map((p: any) => [p.id as string, { full_name: p.full_name as string, role: p.role as string }])
  );

  return messages.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id as string,
      course_id: m.course_id as string,
      user_id: m.user_id as string,
      content: m.content as string,
      created_at: m.created_at as string,
      attachment_url: (m.attachment_url as string | null) ?? null,
      full_name: profile?.full_name ?? null,
      role: profile?.role ?? null,
    };
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Fetch the latest 50 messages for a course.
 * Returns messages in ascending order (oldest first) for natural chat display.
 * The query fetches descending (newest first), then reverses in JS so the UI
 * can render top-to-bottom with the newest message at the bottom.
 */
export async function fetchInitialMessages(
  courseId: string,
  accessToken: string,
): Promise<{ messages: ChatMessage[]; isAdmin?: boolean; error: FetchMessagesError | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return {
        messages: [],
        isAdmin: false,
        error: { type: "ERROR", message: "Unauthorized: Invalid session" },
      };
    }

    const supabaseAdmin = createServiceClient();

    // ── Enrollment check ─────────────────────────────────────────────────────
    let isAdmin = false;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role && (profile.role.toLowerCase() === "admin" || profile.role.toLowerCase() === "instructor" || profile.role.toLowerCase() === "mentor")) {
      isAdmin = true;
    }

    const enrolled = await checkEnrollment(supabaseAdmin, userId, courseId);
    if (!enrolled) {
      return {
        messages: [],
        isAdmin: false,
        error: {
          type: "NOT_ENROLLED",
          message: "You must be enrolled in this course to view messages.",
        },
      };
    }

    const { data, error } = await supabaseAdmin
      .from("course_messages")
      .select(
        `
        id,
        course_id,
        user_id,
        content,
        created_at,
        attachment_url
        `,
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[fetchInitialMessages] Supabase error:", error);
      return { messages: [], error: { type: "ERROR", message: error.message } };
    }

    // Reverse so oldest is first (natural chat order: top = old, bottom = new)
    const rawMessages = (data ?? []).reverse();
    const messages = await hydrateMessagesWithProfiles(supabaseAdmin, rawMessages);

    return { messages, isAdmin, error: null };
  } catch (err) {
    console.error("[fetchInitialMessages] Unexpected error:", err);
    return {
      messages: [],
      isAdmin: false,
      error: {
        type: "ERROR",
        message: err instanceof Error ? err.message : "Failed to load messages.",
      },
    };
  }
}

/**
 * Fetch messages older than a given timestamp (for infinite scroll pagination).
 * Returns up to 50 messages, in ascending order.
 */
export async function fetchOlderMessages(
  courseId: string,
  accessToken: string,
  beforeTimestamp: string,
): Promise<{ messages: ChatMessage[]; error: string | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { messages: [], error: "Unauthorized: Invalid session" };
    }

    const supabaseAdmin = createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("course_messages")
      .select(
        `
        id,
        course_id,
        user_id,
        content,
        created_at,
        attachment_url
        `,
      )
      .eq("course_id", courseId)
      .lt("created_at", beforeTimestamp)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[fetchOlderMessages] Supabase error:", error);
      return { messages: [], error: error.message };
    }

    const rawMessages = (data ?? []).reverse();
    const messages = await hydrateMessagesWithProfiles(supabaseAdmin, rawMessages);

    return { messages, error: null };
  } catch (err) {
    console.error("[fetchOlderMessages] Unexpected error:", err);
    return {
      messages: [],
      error:
        err instanceof Error ? err.message : "Failed to load older messages.",
    };
  }
}

/**
 * Send a message to a course community.
 *
 * Security model:
 * - The service role client bypasses RLS for the insert so we have full control.
 * - We explicitly verify enrollment server-side before inserting, ensuring
 *   the check is on the server and cannot be bypassed by the client.
 * - The user_id is never trusted from the client — it is passed in from the
 *   server action call after the caller verifies the session.
 */
export async function sendCourseMessage(
  accessToken: string,
  courseId: string,
  content: string,
  attachmentUrl?: string | null,
): Promise<{ message: ChatMessage | null; error: string | null }> {
  // ── Input validation ──────────────────────────────────────────────────────
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { message: null, error: "Message cannot be empty." };
  }
  if (trimmedContent.length > 2000) {
    return {
      message: null,
      error: "Message is too long. Maximum 2,000 characters.",
    };
  }
  if (!accessToken || !courseId) {
    return { message: null, error: "Invalid request parameters." };
  }

  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { message: null, error: "Unauthorized: Invalid session" };
    }

    const supabaseAdmin = createServiceClient();

    // ── Enrollment check (server-side, cannot be bypassed) ────────────────
    const enrolled = await checkEnrollment(supabaseAdmin, userId, courseId);
    if (!enrolled) {
      return {
        message: null,
        error: "You must be enrolled in this course to send messages.",
      };
    }

    // ── Insert the message ────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("course_messages")
      .insert({
        course_id: courseId,
        user_id: userId,
        content: trimmedContent,
        ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
      })
      .select(
        `
        id,
        course_id,
        user_id,
        content,
        created_at,
        attachment_url
        `,
      )
      .single();

    if (insertError) {
      console.error("[sendCourseMessage] insert error:", insertError);
      return { message: null, error: "Failed to send message. Please try again." };
    }

    const messages = await hydrateMessagesWithProfiles(supabaseAdmin, [inserted]);
    const message = messages[0] || null;

    return { message, error: null };
  } catch (err) {
    console.error("[sendCourseMessage] Unexpected error:", err);
    return {
      message: null,
      error:
        err instanceof Error ? err.message : "Failed to send message.",
    };
  }
}

/**
 * Delete a course message (admin only).
 */
export async function deleteCourseMessage(
  accessToken: string,
  messageId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { success: false, error: "Unauthorized: Invalid session" };
    }

    const supabaseAdmin = createServiceClient();

    // Check admin bypass
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile?.role || profile.role.toLowerCase() !== "admin") {
      return { success: false, error: "Unauthorized: Admins only." };
    }

    const { error } = await supabaseAdmin
      .from("course_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      console.error("[deleteCourseMessage] Supabase error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[deleteCourseMessage] Unexpected error:", err);
    return { success: false, error: "Failed to delete message." };
  }
}

/**
 * Fetch all communities (courses) a user is enrolled in.
 */
export async function getUserCommunities(accessToken: string): Promise<{
  courses: Array<{ id: string; title: string; thumbnail_url: string | null }>;
  error: string | null;
}> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { courses: [], error: "Unauthorized: Invalid session" };
    }

    const supabaseAdmin = createServiceClient();
    
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", userId)
      .single();

    // Admin bypass
    if (profile?.role && profile.role.toLowerCase() === "admin") {
      const { data: courses, error: courseError } = await supabaseAdmin
        .from("maincourses")
        .select("id, title, thumbnail_url");
      if (courseError) return { courses: [], error: courseError.message };
      return { courses: courses ?? [], error: null };
    }

    // Get courses from phase2.enrollments
    const { data: memberRows, error: memberError } = await supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("course_id, users!inner(auth_user_id)")
      .eq("users.auth_user_id", userId)
      .eq("status", "active");

    // Get courses from course_members
    let courseMemberRows: any[] = [];
    if (profile?.email) {
      const { data: cMembers } = await supabaseAdmin
        .from("course_members")
        .select("maincourse_id")
        .eq("email", profile.email)
        .eq("status", "active");
      if (cMembers) courseMemberRows = cMembers;
    }
    
    const enrollmentCourseIds = memberRows?.map((r: any) => r.course_id).filter((id: any) => id !== null) || [];
    const memberCourseIds = courseMemberRows?.map((r: any) => r.maincourse_id).filter((id: any) => id !== null) || [];

    const courseIds = Array.from(new Set([...enrollmentCourseIds, ...memberCourseIds]));
    
    if (courseIds.length === 0) return { courses: [], error: null };

    // Get course details
    const { data: courses, error: courseError } = await supabaseAdmin
      .from("maincourses")
      .select("id, title, thumbnail_url")
      .in("id", courseIds);
      
    if (courseError) return { courses: [], error: courseError.message };

    return { courses: courses ?? [], error: null };
  } catch (err) {
    console.error("[getUserCommunities] Unexpected error:", err);
    return { courses: [], error: "Failed to load communities." };
  }
}

/**
 * Fetch mentors, instructors, and admins who are associated with a course.
 * Used to populate the @mention dropdown in the community chat.
 */
export async function getMentionablePeople(
  courseId: string,
  accessToken: string,
): Promise<{ people: MentionablePerson[]; error: string | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { people: [], error: "Unauthorized: Invalid session" };
    }

    const supabaseAdmin = createServiceClient();

    // Get all admin profiles
    const { data: adminProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["admin", "instructor", "mentor"])
      .not("full_name", "is", null);

    // Also get course_members with active status for this course (mentors/instructors)
    const { data: courseMembers } = await supabaseAdmin
      .from("course_members")
      .select("email")
      .eq("maincourse_id", courseId)
      .eq("status", "active");

    const courseMemberEmails = new Set(
      (courseMembers ?? []).map((cm: any) => cm.email?.toLowerCase())
    );

    // Get profiles for course members who are not already in adminProfiles
    const adminIds = new Set((adminProfiles ?? []).map((p: any) => p.id));
    let extraPeople: MentionablePerson[] = [];

    if (courseMemberEmails.size > 0) {
      const { data: memberProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, email")
        .not("full_name", "is", null);

      extraPeople = (memberProfiles ?? [])
        .filter((p: any) => 
          courseMemberEmails.has(p.email?.toLowerCase()) && !adminIds.has(p.id)
        )
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name ?? "Unknown",
          role: p.role ?? "mentor",
        }));
    }

    const people: MentionablePerson[] = [
      ...(adminProfiles ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name ?? "Unknown",
        role: p.role ?? "admin",
      })),
      ...extraPeople,
    ];

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = people.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return { people: unique, error: null };
  } catch (err) {
    console.error("[getMentionablePeople] Unexpected error:", err);
    return { people: [], error: "Failed to load mentionable people." };
  }
}

