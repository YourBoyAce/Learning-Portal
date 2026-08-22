"use server";

import { createClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MentionNotification {
  id: string;
  sender_user_id: string;
  sender_name: string | null;
  course_id: string;
  course_title: string | null;
  message_id: string;
  message_preview: string;
  read_at: string | null;
  created_at: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getSecureUserId(accessToken: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(accessToken);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Creates mention notification rows for tagged admins/mentors.
 * Skips self-mentions and non-staff recipients.
 */
export async function createMentionNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  params: {
    senderUserId: string;
    messageId: string;
    courseId: string;
    content: string;
    mentionedUserIds: string[];
  },
): Promise<void> {
  const { senderUserId, messageId, courseId, content, mentionedUserIds } =
    params;

  if (mentionedUserIds.length === 0) return;

  const uniqueIds = Array.from(new Set(mentionedUserIds)).filter(
    (id) => id !== senderUserId,
  );
  if (uniqueIds.length === 0) return;

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .in("id", uniqueIds);

  const staffRoles = new Set(["admin", "instructor", "mentor"]);
  const staffRecipients = (profiles ?? [])
    .filter((p: { id: string; role: string | null }) =>
      staffRoles.has((p.role ?? "").toLowerCase()),
    )
    .map((p: { id: string }) => p.id);

  if (staffRecipients.length === 0) return;

  const preview =
    content.length > 120 ? `${content.slice(0, 117)}...` : content;

  const rows = staffRecipients.map((recipientId: string) => ({
    recipient_user_id: recipientId,
    sender_user_id: senderUserId,
    message_id: messageId,
    course_id: courseId,
    message_preview: preview,
  }));

  const { error } = await supabaseAdmin
    .from("mention_notifications")
    .insert(rows);

  if (error) {
    console.error("[createMentionNotifications] insert error:", error);
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getMentionNotifications(
  accessToken: string,
  limit = 20,
): Promise<{
  notifications: MentionNotification[];
  unreadCount: number;
  error: string | null;
}> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { notifications: [], unreadCount: 0, error: "Unauthorized" };
    }

    const supabaseAdmin = createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("mention_notifications")
      .select(
        `
        id,
        sender_user_id,
        course_id,
        message_id,
        message_preview,
        read_at,
        created_at
        `,
      )
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getMentionNotifications] fetch error:", error);
      return { notifications: [], unreadCount: 0, error: error.message };
    }

    const { count: unreadCount } = await supabaseAdmin
      .from("mention_notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    const senderIds = Array.from(
      new Set((data ?? []).map((n) => n.sender_user_id as string)),
    );
    const courseIds = Array.from(
      new Set((data ?? []).map((n) => n.course_id as string)),
    );

    const [{ data: senders }, { data: courses }] = await Promise.all([
      senderIds.length > 0
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name")
            .in("id", senderIds)
        : Promise.resolve({ data: [] }),
      courseIds.length > 0
        ? supabaseAdmin
            .from("maincourses")
            .select("id, title")
            .in("id", courseIds)
        : Promise.resolve({ data: [] }),
    ]);

    const senderMap = new Map(
      (senders ?? []).map((s: { id: string; full_name: string | null }) => [
        s.id,
        s.full_name,
      ]),
    );
    const courseMap = new Map(
      (courses ?? []).map((c: { id: string; title: string }) => [
        c.id,
        c.title,
      ]),
    );

    const notifications: MentionNotification[] = (data ?? []).map((n) => ({
      id: n.id as string,
      sender_user_id: n.sender_user_id as string,
      sender_name: senderMap.get(n.sender_user_id as string) ?? null,
      course_id: n.course_id as string,
      course_title: courseMap.get(n.course_id as string) ?? null,
      message_id: n.message_id as string,
      message_preview: n.message_preview as string,
      read_at: (n.read_at as string | null) ?? null,
      created_at: n.created_at as string,
    }));

    return {
      notifications,
      unreadCount: unreadCount ?? 0,
      error: null,
    };
  } catch (err) {
    console.error("[getMentionNotifications] unexpected error:", err);
    return {
      notifications: [],
      unreadCount: 0,
      error: "Failed to load notifications.",
    };
  }
}

export async function markMentionNotificationRead(
  accessToken: string,
  notificationId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabaseAdmin = createServiceClient();
    const { error } = await supabaseAdmin
      .from("mention_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Failed to mark notification as read." };
  }
}

export async function markAllMentionNotificationsRead(
  accessToken: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const userId = await getSecureUserId(accessToken);
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const supabaseAdmin = createServiceClient();
    const { error } = await supabaseAdmin
      .from("mention_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Failed to mark notifications as read." };
  }
}
