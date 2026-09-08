"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  createMentionNotifications,
} from "./mention-notifications";
import { resolveMentionedUserIds } from "@/app/lib/mentions";
import { logAndReturnActionError } from "@/app/lib/error-handler";
import { logError } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Cached module-level clients (created once per server process) ────────────

let _serviceClient: SupabaseClient | null = null;
function createServiceClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  if (!_serviceClient) {
    _serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _serviceClient;
}

let _anonClient: SupabaseClient | null = null;
function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _anonClient;
}

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

export interface CommunitySidebarItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  lastMessage: string;
  lastActivityRaw: string | null;
  lastActivity: string;
  unread: number;
}

export type FetchMessagesError = { type: "NOT_ENROLLED" | "ERROR"; message: string };

/**
 * Derives the securely authenticated user ID from the access token.
 */
async function getSecureUserId(accessToken: string): Promise<string | null> {
  try {
    const { data: { user }, error } = await getAnonClient().auth.getUser(accessToken);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Verifies whether a user (by userId) is enrolled in a course via the
 * batch_members → batches relationship.
 * Accepts a pre-fetched profile to avoid a redundant DB call when the
 * caller already has the profile.
 */
async function checkEnrollment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  courseId: string,
  // Optionally pass already-fetched profile to skip redundant DB call
  cachedProfile?: { role: string | null; email: string | null } | null,
): Promise<boolean> {
  const profile = cachedProfile ?? await (async () => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", userId)
      .single();
    return data as { role: string | null; email: string | null } | null;
  })();

  // Admin bypass — no enrollment check needed
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Maps raw DB rows (which may contain a nested profiles object from a join)
 * into the typed ChatMessage shape. Falls back to a separate profiles query
 * only if the rows don't already carry profile data.
 */
async function hydrateMessagesWithProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  messages: any[],
): Promise<ChatMessage[]> {
  if (!messages || messages.length === 0) return [];

  // If profiles were already joined, map directly — no extra query needed.
  if (messages[0]?.profiles !== undefined) {
    return messages.map((m) => ({
      id: m.id as string,
      course_id: m.course_id as string,
      user_id: m.user_id as string,
      content: m.content as string,
      created_at: m.created_at as string,
      attachment_url: (m.attachment_url as string | null) ?? null,
      full_name: (m.profiles?.full_name as string | null) ?? null,
      role: (m.profiles?.role as string | null) ?? null,
    }));
  }

  // Fallback: batch-fetch profiles by unique user IDs
  const userIds = Array.from(new Set(messages.map((m) => m.user_id)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .in("id", userIds);

  const profileMap = new Map<string, { full_name: string | null; role: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Single profile fetch — reused for isAdmin check AND passed to checkEnrollment
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", userId)
      .single();

    const isAdmin = !!(
      profile?.role &&
      ["admin", "instructor", "mentor"].includes(profile.role.toLowerCase())
    );

    const enrolled = await checkEnrollment(supabaseAdmin, userId, courseId, profile);
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

    // Fetch messages — profiles are hydrated separately (no FK to profiles table)
    const { data, error } = await supabaseAdmin
      .from("course_messages")
      .select(
        `id, course_id, user_id, content, created_at, attachment_url`,
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
        `id, course_id, user_id, content, created_at, attachment_url`,
      )
      .eq("course_id", courseId)
      .lt("created_at", beforeTimestamp)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[fetchOlderMessages] Supabase error:", error);
      return { messages: [], error: logError(error).message };
    }

    const rawMessages = (data ?? []).reverse();
    const messages = await hydrateMessagesWithProfiles(supabaseAdmin, rawMessages);

    return { messages, error: null };
  } catch (err) {
    console.error("[fetchOlderMessages] Unexpected error:", err);
    return {
      messages: [],
      error: logError(err).message,
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
async function fetchMentionablePeopleInternal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  courseId: string,
): Promise<MentionablePerson[]> {
  // Fetch all active members assigned to this specific course
  const { data: courseMembers } = await supabaseAdmin
    .from("course_members")
    .select("email")
    .eq("maincourse_id", courseId)
    .eq("status", "active");

  const courseMemberEmails = new Set(
    (courseMembers ?? []).map((cm: { email?: string }) =>
      cm.email?.toLowerCase(),
    ),
  );

  if (courseMemberEmails.size === 0) {
    return [];
  }

  // Fetch only staff profiles (admin/instructor/mentor) whose email is
  // in the course_members list for this course — not all mentors globally.
  const { data: staffProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, email")
    .in("role", ["admin", "instructor", "mentor"])
    .not("full_name", "is", null);

  const people: MentionablePerson[] = (staffProfiles ?? [])
    .filter((p: { email?: string }) =>
      courseMemberEmails.has(p.email?.toLowerCase() ?? ""),
    )
    .map((p: { id: string; full_name: string | null; role: string | null }) => ({
      id: p.id,
      full_name: p.full_name ?? "Unknown",
      role: p.role ?? "mentor",
    }));

  const seen = new Set<string>();
  return people.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export async function sendCourseMessage(
  accessToken: string,
  courseId: string,
  content: string,
  attachmentUrl?: string | null,
  mentionedUserIds?: string[],
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

    // Single profile fetch reused for checkEnrollment
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, email, full_name")
      .eq("id", userId)
      .single();

    // ── Enrollment check (server-side, cannot be bypassed) ────────────────
    const enrolled = await checkEnrollment(supabaseAdmin, userId, courseId, profile);
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
        `id, course_id, user_id, content, created_at, attachment_url`,
      )
      .single();

    if (insertError) {
      console.error("[sendCourseMessage] insert error:", insertError);
      return { message: null, error: "Failed to send message. Please try again." };
    }

    const messages = await hydrateMessagesWithProfiles(supabaseAdmin, [inserted]);
    const message = messages[0] || null;

    if (message) {
      // Only fetch mentionable people if there are actual @mentions in the content
      // and the caller didn't already provide validated IDs.
      const hasMentions = trimmedContent.includes("@");
      let validatedIds: string[] = [];

      if (hasMentions) {
        const mentionablePeople = await fetchMentionablePeopleInternal(supabaseAdmin, courseId);
        const parsedIds = resolveMentionedUserIds(trimmedContent, mentionablePeople);
        const mentionableIdSet = new Set(mentionablePeople.map((p) => p.id));
        validatedIds = Array.from(
          new Set([
            ...parsedIds,
            ...(mentionedUserIds ?? []).filter((id) => mentionableIdSet.has(id)),
          ]),
        );
      }

      if (validatedIds.length > 0) {
        await createMentionNotifications(supabaseAdmin, {
          senderUserId: userId,
          messageId: message.id,
          courseId,
          content: trimmedContent,
          mentionedUserIds: validatedIds,
        });
      }
    }

    return { message, error: null };
  } catch (err) {
    console.error("[sendCourseMessage] Unexpected error:", err);
    return {
      message: null,
      error: logError(err).message,
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
      return logAndReturnActionError(error);
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
      if (courseError) return { courses: [], error: logError(courseError).message };
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
      
    if (courseError) return { courses: [], error: logError(courseError).message };

    return { courses: courses ?? [], error: null };
  } catch (err) {
    console.error("[getUserCommunities] Unexpected error:", err);
    return { courses: [], error: "Failed to load communities." };
  }
}

/**
 * Fetches sidebar data for all enrolled courses in a SINGLE batch:
 * the last message per course AND the unread count per course — all in two
 * queries regardless of how many courses there are. Replaces the old N×2
 * per-course waterfall done client-side.
 */
export async function getCommunitySidebarData(
  accessToken: string,
  userId: string,
): Promise<{
  items: CommunitySidebarItem[];
  error: string | null;
}> {
  try {
    const supabaseAdmin = createServiceClient();

    // Resolve enrolled course IDs
    const { courses, error: coursesError } = await getUserCommunities(accessToken);
    if (coursesError) return { items: [], error: coursesError };
    if (courses.length === 0) return { items: [], error: null };

    const courseIds = courses.map((c) => String(c.id));

    // Batch 1: last message per course — fetch last 1 message per course in a
    // single query ordered by created_at desc, then deduplicate in JS.
    const { data: recentMessages } = await supabaseAdmin
      .from("course_messages")
      .select("course_id, content, created_at")
      .in("course_id", courseIds)
      .order("created_at", { ascending: false });

    // Keep only the first (most recent) message per course
    const lastMsgMap = new Map<string, { content: string; created_at: string }>();
    for (const row of recentMessages ?? []) {
      const cid = String(row.course_id);
      if (!lastMsgMap.has(cid)) {
        lastMsgMap.set(cid, { content: row.content, created_at: row.created_at });
      }
    }

    // Batch 2: read timestamps for this user across all courses
    const { data: readData } = await supabaseAdmin
      .from("community_reads")
      .select("course_id, last_read_at")
      .eq("user_id", userId)
      .in("course_id", courseIds);

    const readMap = new Map<string, string>(
      (readData ?? []).map((r: any) => [String(r.course_id), r.last_read_at as string])
    );

    // Batch 3: unread counts — fetch all messages newer than each course's last_read_at.
    // We do this in a single query and count in JS to avoid N queries.
    const oldestReadAt = (() => {
      let oldest = new Date().toISOString();
      for (const ts of readMap.values()) {
        if (ts < oldest) oldest = ts;
      }
      return oldest;
    })();

    const { data: unreadMessages } = await supabaseAdmin
      .from("course_messages")
      .select("course_id, created_at")
      .in("course_id", courseIds)
      .gt("created_at", oldestReadAt);

    // Count unread per course (messages newer than that course's last_read_at)
    const unreadCountMap = new Map<string, number>();
    for (const row of unreadMessages ?? []) {
      const cid = String(row.course_id);
      const lastRead = readMap.get(cid) ?? "1970-01-01T00:00:00.000Z";
      if (row.created_at > lastRead) {
        unreadCountMap.set(cid, (unreadCountMap.get(cid) ?? 0) + 1);
      }
    }

    const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

    const items: CommunitySidebarItem[] = courses.map((course) => {
      const cid = String(course.id);
      const lastMsg = lastMsgMap.get(cid);
      return {
        id: cid,
        title: course.title,
        thumbnail_url: course.thumbnail_url,
        lastMessage: lastMsg?.content ?? "No messages yet",
        lastActivityRaw: lastMsg?.created_at ?? null,
        lastActivity: lastMsg?.created_at
          ? dateFormatter.format(new Date(lastMsg.created_at))
          : "",
        unread: unreadCountMap.get(cid) ?? 0,
      };
    });

    // Sort by most recent activity
    items.sort((a, b) => {
      const dateA = a.lastActivityRaw ? new Date(a.lastActivityRaw).getTime() : 0;
      const dateB = b.lastActivityRaw ? new Date(b.lastActivityRaw).getTime() : 0;
      return dateB - dateA;
    });

    return { items, error: null };
  } catch (err) {
    console.error("[getCommunitySidebarData] Unexpected error:", err);
    return { items: [], error: "Failed to load community sidebar data." };
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
    const people = await fetchMentionablePeopleInternal(supabaseAdmin, courseId);

    return { people, error: null };
  } catch (err) {
    console.error("[getMentionablePeople] Unexpected error:", err);
    return { people: [], error: "Failed to load mentionable people." };
  }
}

