"use server";

import { createClient } from "@supabase/supabase-js";
import { logError } from "@/app/lib/error-handler";

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

async function getSecureUser(accessToken: string) {
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
    return user;
  } catch {
    return null;
  }
}

/**
 * Returns the number of upcoming accepted 1-on-1 meetings for the authenticated user.
 * - Works for students (searching by Student ID in description or user_id)
 * - Works for mentors / instructors / admins (searching by user_id)
 * - Evaluates `event_date + event_time >= now` so expired meetings automatically drop off.
 */
export async function getUpcomingMeetingsCount(
  accessToken: string,
): Promise<{ count: number; error?: string }> {
  try {
    if (!accessToken) {
      return { count: 0, error: "Missing access token" };
    }

    const user = await getSecureUser(accessToken);
    if (!user) {
      return { count: 0, error: "Unauthorized" };
    }

    const supabaseAdmin = createServiceClient();

    // Fetch user's profile to check role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role?.toLowerCase() || "user";
    const isMentor = role === "instructor" || role === "admin";

    // Query events from today onwards for high performance
    const todayStr = new Date().toISOString().split("T")[0];

    let query = supabaseAdmin
      .from("calendar_events")
      .select("event_date, event_time")
      .like("tag", "%status:accepted%")
      .gte("event_date", todayStr);

    if (isMentor) {
      query = query.eq("user_id", user.id);
    } else {
      query = query.or(`user_id.eq.${user.id},description.ilike.%Student ID: ${user.id}%`);
    }

    const { data: rawEvents, error: fetchErr } = await query;
    if (fetchErr) {
      throw fetchErr;
    }

    const now = new Date();
    const count = (rawEvents || []).filter((e) => {
      const sessionTime = new Date(`${e.event_date}T${e.event_time}`);
      return sessionTime >= now;
    }).length;

    return { count };
  } catch (err) {
    console.error("[getUpcomingMeetingsCount] Error:", logError(err).message);
    return { count: 0, error: logError(err).message };
  }
}
