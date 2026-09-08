import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const currentUser = authData.user;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Fetch current user's profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", currentUser.id)
    .single();

  const role = profile?.role?.toLowerCase() || "user";
  const isMentor = role === "instructor" || role === "admin";

  let sessions = [];

  if (isMentor) {
    // Mentors: Query events they own (user_id = mentor.id) and are accepted
    const { data: events, error: fetchError } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("user_id", currentUser.id)
      .like("tag", "%status:accepted%")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (fetchError) {
      return apiErrorResponse(fetchError, undefined, 500);
    }

    // Format events for mentor view
    sessions = (events || []).map((event) => {
      // Parse student details from description
      let studentName = "Student";
      let studentEmail = "";
      const desc = event.description || "";
      const requestedByMatch = desc.match(/Requested by:\s*(.*?)\s*\((.*?)\)/);
      if (requestedByMatch) {
        studentName = requestedByMatch[1].trim();
        studentEmail = requestedByMatch[2].trim();
      }

      // Parse duration from tag (e.g. status:accepted|dur:60)
      let duration = 60;
      if (event.tag) {
        const match = event.tag.match(/dur:(\d+)/);
        if (match) duration = parseInt(match[1], 10);
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_time: event.event_time,
        meet_link: event.meet_link,
        duration,
        studentName,
        studentEmail,
      };
    });

  } else {
    // Students: Query calendar_events where description contains Student ID: <their_id> AND tag contains status:accepted
    const { data: events, error: fetchError } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .like("tag", "%status:accepted%")
      .like("description", `%Student ID: ${currentUser.id}%`)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (fetchError) {
      return apiErrorResponse(fetchError, undefined, 500);
    }

    // Fetch all mentors profiles in one query
    const mentorIds = Array.from(new Set((events || []).map(e => e.user_id)));
    const mentorsMap = new Map();
    if (mentorIds.length > 0) {
      const { data: mentorProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", mentorIds);

      if (mentorProfiles) {
        mentorProfiles.forEach(p => {
          mentorsMap.set(p.id, p);
        });
      }
    }

    sessions = (events || []).map((event) => {
      const mentor = mentorsMap.get(event.user_id);
      const mentorName = mentor?.full_name || "Instructor";
      const mentorEmail = mentor?.email || "";

      let duration = 60;
      if (event.tag) {
        const match = event.tag.match(/dur:(\d+)/);
        if (match) duration = parseInt(match[1], 10);
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_time: event.event_time,
        meet_link: event.meet_link,
        duration,
        mentorName,
        mentorEmail,
      };
    });
  }

  return NextResponse.json({ success: true, isMentor, sessions });
}
