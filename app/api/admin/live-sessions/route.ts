import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorResponse } from "@/app/lib/error-handler";
import {
  addMinutesToTime,
  computeDurationMinutes,
  extractDurationFromTag,
  splitEventDateTime,
} from "@/app/lib/live-session-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ProMember {
  id: string;
  name: string;
  email: string;
}

async function authenticateAdminRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    } as const;
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    } as const;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profile?.role?.toLowerCase() !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Admin access required." },
        { status: 403 },
      ),
    } as const;
  }

  return { user: authData.user } as const;
}

async function fetchProUsers(): Promise<ProMember[]> {
  const { data: profiles, error: profError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (profError) throw profError;

  const authMetadataPlanMap = new Map<string, string>();
  try {
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    for (const u of authUsersData?.users ?? []) {
      const plan = String(
        u.user_metadata?.plan ??
          u.app_metadata?.plan ??
          u.user_metadata?.tier ??
          u.app_metadata?.tier ??
          "",
      )
        .trim()
        .toLowerCase();
      if (plan === "pro" || plan === "premium") {
        authMetadataPlanMap.set(u.id, "pro");
      } else if (plan === "starter") {
        authMetadataPlanMap.set(u.id, "starter");
      }
    }
  } catch (err) {
    console.warn("[admin/live-sessions] Could not list auth users:", err);
  }

  const phase2NameMap = new Map<string, string>();
  const phase2PlanMap = new Map<string, string>();
  try {
    const { data: p2Users } = await supabaseAdmin
      .schema("phase2")
      .from("users")
      .select("id, auth_user_id, email, username");

    const p2IdToAuthId = new Map<string, string>();
    for (const u of (p2Users ?? []) as Array<{
      id: string;
      auth_user_id?: string | null;
      email?: string | null;
      username?: string | null;
    }>) {
      if (u.auth_user_id && u.username) {
        phase2NameMap.set(u.auth_user_id, u.username.trim());
      }
      if (u.email && u.username) {
        phase2NameMap.set(u.email.toLowerCase(), u.username.trim());
      }
      if (u.auth_user_id && u.id) {
        p2IdToAuthId.set(u.id, u.auth_user_id);
      }
    }

    const { data: p2Enrollments } = await supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("user_id, bundles(bundle_name)")
      .eq("status", "active");

    for (const e of (p2Enrollments ?? []) as Array<{
      user_id: string;
      bundles?: { bundle_name?: string } | Array<{ bundle_name?: string }> | null;
    }>) {
      const bn = Array.isArray(e.bundles)
        ? (e.bundles[0]?.bundle_name ?? "")
        : (e.bundles?.bundle_name ?? "");
      const lower = bn.toLowerCase();
      const planStr =
        lower.includes("pro") || lower.includes("premium") ? "pro" : "starter";
      const authId = p2IdToAuthId.get(e.user_id) || e.user_id;
      const curr = phase2PlanMap.get(authId);
      if (!curr || (curr === "starter" && planStr === "pro")) {
        phase2PlanMap.set(authId, planStr);
      }
    }
  } catch (err) {
    console.warn("[admin/live-sessions] Could not inspect phase2 enrollments:", err);
  }

  const proMembers: ProMember[] = [];
  for (const profile of profiles ?? []) {
    const role = (profile.role || "user").toLowerCase();
    if (role === "admin" || role === "instructor" || role === "mentor" || role === "lead mentor") {
      continue;
    }

    const enrollmentPlan = phase2PlanMap.get(profile.id);
    const metadataPlan = authMetadataPlanMap.get(profile.id);
    const isPro = enrollmentPlan === "pro" || metadataPlan === "pro";

    if (!isPro) continue;

    const p2Name =
      phase2NameMap.get(profile.id) ||
      phase2NameMap.get(profile.email?.toLowerCase() || "");
    const resolvedName =
      p2Name ||
      profile.full_name ||
      profile.email?.split("@")[0] ||
      "Pro Learner";

    proMembers.push({
      id: profile.id,
      name: resolvedName,
      email: profile.email || "",
    });
  }

  proMembers.sort((a, b) => a.name.localeCompare(b.name));
  return proMembers;
}

function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const [proUsers, webinarsRes, eventsRes] = await Promise.all([
      fetchProUsers(),
      supabaseAdmin
        .from("webinars")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("calendar_events")
        .select("id, user_id, webinar_id, event_date, event_time, tag, meet_link")
        .eq("event_type", "webinar"),
    ]);

    if (webinarsRes.error) throw webinarsRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const assignedByWebinarId = new Map<string, Set<string>>();
    const metaByWebinarId = new Map<
      string,
      { event_date: string; event_time: string; duration_minutes: number; meet_link: string }
    >();

    for (const ev of eventsRes.data ?? []) {
      if (ev.webinar_id == null) continue;
      const key = String(ev.webinar_id);
      if (!assignedByWebinarId.has(key)) {
        assignedByWebinarId.set(key, new Set());
      }
      if (ev.user_id) {
        assignedByWebinarId.get(key)!.add(String(ev.user_id));
      }
      if (!metaByWebinarId.has(key)) {
        metaByWebinarId.set(key, {
          event_date: ev.event_date || "",
          event_time: (ev.event_time || "").slice(0, 5),
          duration_minutes: extractDurationFromTag(ev.tag, 60),
          meet_link: ev.meet_link || "",
        });
      }
    }

    const sessions = (webinarsRes.data ?? []).map((w) => {
      const key = String(w.id);
      const assignedIds = Array.from(assignedByWebinarId.get(key) ?? []);
      const calMeta = metaByWebinarId.get(key);
      const { date, startTime } = splitEventDateTime(
        w.event_date,
        calMeta?.event_date,
        calMeta?.event_time,
      );
      const durationMinutes = calMeta?.duration_minutes ?? 60;
      const endTime = startTime ? addMinutesToTime(startTime, durationMinutes) : "";

      return {
        ...w,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        link_text: w.link_text || calMeta?.meet_link || "",
        assigned_user_ids: assignedIds,
      };
    });

    return NextResponse.json({
      success: true,
      sessions,
      proUsers,
    });
  } catch (error) {
    return apiErrorResponse(error, "GET /api/admin/live-sessions", 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const subtitle = typeof body?.subtitle === "string" ? body.subtitle.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const sessionDate = typeof body?.date === "string" ? body.date.trim() : "";
    const startTime = typeof body?.startTime === "string" ? body.startTime.trim() : "";
    const endTime = typeof body?.endTime === "string" ? body.endTime.trim() : "";
    const meetingLink = normalizeHttpUrl(body?.meetingLink);
    const selectedUserIds: string[] = Array.isArray(body?.selectedUserIds)
      ? Array.from(new Set(body.selectedUserIds.map((id: unknown) => String(id).trim()).filter(Boolean)))
      : [];

    if (!title) {
      return NextResponse.json({ error: "Live session title is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !/^\d{2}:\d{2}/.test(startTime)) {
      return NextResponse.json(
        { error: "A valid date and start time are required." },
        { status: 400 },
      );
    }
    if (endTime && computeDurationMinutes(startTime, endTime, -1) <= 0) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }
    if (!meetingLink) {
      return NextResponse.json(
        { error: "A valid Zoom meeting link URL (https://...) is required." },
        { status: 400 },
      );
    }
    if (selectedUserIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one Pro user." },
        { status: 400 },
      );
    }

    const durationMinutes = endTime
      ? computeDurationMinutes(startTime, endTime, 60)
      : 60;
    const cleanStartTime = startTime.slice(0, 5);
    const combinedEventDate = `${sessionDate}T${cleanStartTime}`;

    const { data: created, error: insertError } = await supabaseAdmin
      .from("webinars")
      .insert([
        {
          title,
          subtitle,
          description,
          event_date: combinedEventDate,
          icon: "📋",
          status: "link",
          link_text: meetingLink,
          attendees_count: selectedUserIds.length,
        },
      ])
      .select("id")
      .single();

    if (insertError) throw insertError;

    const tag = `status:scheduled|live-session|dur:${durationMinutes}`;
    const calendarRows = selectedUserIds.map((userId) => ({
      user_id: userId,
      webinar_id: created.id,
      title,
      description:
        description ||
        `Live Session: ${title}${subtitle ? ` · Hosted by ${subtitle}` : ""}`,
      event_date: sessionDate,
      event_time: `${cleanStartTime}:00`,
      event_type: "webinar",
      tag,
      meet_link: meetingLink,
    }));

    const { error: calError } = await supabaseAdmin
      .from("calendar_events")
      .insert(calendarRows);

    if (calError) {
      // Roll back webinar row if assignment failed so state stays consistent
      await supabaseAdmin.from("webinars").delete().eq("id", created.id);
      throw calError;
    }

    return NextResponse.json({
      success: true,
      id: created.id,
      assignedCount: selectedUserIds.length,
    });
  } catch (error) {
    return apiErrorResponse(error, "POST /api/admin/live-sessions", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => null);
    const id = body?.id;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const subtitle = typeof body?.subtitle === "string" ? body.subtitle.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const sessionDate = typeof body?.date === "string" ? body.date.trim() : "";
    const startTime = typeof body?.startTime === "string" ? body.startTime.trim() : "";
    const endTime = typeof body?.endTime === "string" ? body.endTime.trim() : "";
    const meetingLink = normalizeHttpUrl(body?.meetingLink);
    const selectedUserIds: string[] = Array.isArray(body?.selectedUserIds)
      ? Array.from(new Set(body.selectedUserIds.map((uid: unknown) => String(uid).trim()).filter(Boolean)))
      : [];

    if (!id) {
      return NextResponse.json({ error: "Live session id is required." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Live session title is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !/^\d{2}:\d{2}/.test(startTime)) {
      return NextResponse.json(
        { error: "A valid date and start time are required." },
        { status: 400 },
      );
    }
    if (endTime && computeDurationMinutes(startTime, endTime, -1) <= 0) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }
    if (!meetingLink) {
      return NextResponse.json(
        { error: "A valid Zoom meeting link URL (https://...) is required." },
        { status: 400 },
      );
    }
    if (selectedUserIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one Pro user." },
        { status: 400 },
      );
    }

    const durationMinutes = endTime
      ? computeDurationMinutes(startTime, endTime, 60)
      : 60;
    const cleanStartTime = startTime.slice(0, 5);
    const combinedEventDate = `${sessionDate}T${cleanStartTime}`;

    const { error: updateError } = await supabaseAdmin
      .from("webinars")
      .update({
        title,
        subtitle,
        description,
        event_date: combinedEventDate,
        status: "link",
        link_text: meetingLink,
        attendees_count: selectedUserIds.length,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    const { data: existingRows, error: fetchExistingErr } = await supabaseAdmin
      .from("calendar_events")
      .select("id, user_id")
      .eq("webinar_id", id)
      .eq("event_type", "webinar");

    if (fetchExistingErr) throw fetchExistingErr;

    const selectedSet = new Set(selectedUserIds);
    const existingByUser = new Map<string, string>();
    const idsToDelete: string[] = [];

    for (const row of existingRows ?? []) {
      const uid = String(row.user_id);
      if (selectedSet.has(uid) && !existingByUser.has(uid)) {
        existingByUser.set(uid, String(row.id));
      } else {
        idsToDelete.push(String(row.id));
      }
    }

    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("calendar_events")
        .delete()
        .in("id", idsToDelete);
      if (delErr) throw delErr;
    }

    const tag = `status:scheduled|live-session|dur:${durationMinutes}`;
    const sharedPayload = {
      title,
      description:
        description ||
        `Live Session: ${title}${subtitle ? ` · Hosted by ${subtitle}` : ""}`,
      event_date: sessionDate,
      event_time: `${cleanStartTime}:00`,
      tag,
      meet_link: meetingLink,
    };

    const existingEventIds = Array.from(existingByUser.values());
    if (existingEventIds.length > 0) {
      const { error: updEvErr } = await supabaseAdmin
        .from("calendar_events")
        .update(sharedPayload)
        .in("id", existingEventIds);
      if (updEvErr) throw updEvErr;
    }

    const newUserIds = selectedUserIds.filter((uid) => !existingByUser.has(uid));
    if (newUserIds.length > 0) {
      const rowsToInsert = newUserIds.map((userId) => ({
        ...sharedPayload,
        user_id: userId,
        webinar_id: id,
        event_type: "webinar",
      }));
      const { error: insErr } = await supabaseAdmin
        .from("calendar_events")
        .insert(rowsToInsert);
      if (insErr) throw insErr;
    }

    return NextResponse.json({
      success: true,
      assignedCount: selectedUserIds.length,
    });
  } catch (error) {
    return apiErrorResponse(error, "PUT /api/admin/live-sessions", 500);
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Live session id is required." }, { status: 400 });
    }

    const { error: calDelErr } = await supabaseAdmin
      .from("calendar_events")
      .delete()
      .eq("webinar_id", id)
      .eq("event_type", "webinar");
    if (calDelErr) throw calDelErr;

    const { error: delErr } = await supabaseAdmin
      .from("webinars")
      .delete()
      .eq("id", id);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "DELETE /api/admin/live-sessions", 500);
  }
}

