import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
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

  const student = authData.user;

  // Fetch student's profile to get their name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", student.id)
    .maybeSingle();

  const studentName = profile?.full_name || student.email || "Student";
  const studentEmail = profile?.email || student.email || "";

  const body = await request.json().catch(() => null);
  const { mentorId, date, time, duration, topic } = body || {};

  if (!mentorId || !date || !time || !duration || !topic) {
    return NextResponse.json(
      { error: "mentorId, date, time, duration, and topic are required." },
      { status: 400 }
    );
  }

  // Create supabaseAdmin client to bypass RLS and insert for mentor
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Construct compact tag and formatted description containing student details
  const tag = `status:pending|dur:${duration}`;
  const formattedDescription = `${topic}

---
Requested by: ${studentName} (${studentEmail})
Student ID: ${student.id}
Duration: ${duration} minutes`;

  // Insert event into calendar_events
  const { data: event, error: insertError } = await supabaseAdmin
    .from("calendar_events")
    .insert({
      user_id: mentorId,
      title: `1-on-1 with ${studentName}`,
      description: formattedDescription,
      event_date: date,
      event_time: time.length === 5 ? `${time}:00` : time,
      event_type: "session",
      tag,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting booking request:", insertError.message);
    return apiErrorResponse(insertError, undefined, 500);
  }

  return NextResponse.json({ success: true, event });
}
