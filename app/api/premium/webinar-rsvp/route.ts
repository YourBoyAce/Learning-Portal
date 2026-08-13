import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
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
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

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

  const body = await request.json().catch(() => null);
  const { eventId, action } = body || {};

  if (!eventId || !action) {
    return NextResponse.json(
      { error: "eventId and action ('accept' or 'decline') are required." },
      { status: 400 },
    );
  }

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'accept' or 'decline'." },
      { status: 400 },
    );
  }

  const { data: event, error: fetchError } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (event.user_id !== currentUser.id) {
    return NextResponse.json(
      { error: "Unauthorized: invite does not belong to you." },
      { status: 403 },
    );
  }

  if (action === "accept") {
    const currentTag = event.tag || "";
    const nextTag = currentTag.includes("status:accepted")
      ? currentTag
      : currentTag.replace(/status:(pending|declined)/, "status:accepted");

    const { error: updateError } = await supabaseAdmin
      .from("calendar_events")
      .update({
        tag: nextTag || "status:accepted",
      })
      .eq("id", eventId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "accepted" });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: "declined" });
}
