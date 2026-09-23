import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AuthContext =
  | { error: NextResponse }
  | { supabaseAdmin: SupabaseClient };

async function authenticateAdmin(request: Request): Promise<AuthContext> {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 },
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: profile, error: profileError } = await supabaseUser
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role?.toLowerCase() !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseClient;

  return { supabaseAdmin };
}

/**
 * GET /api/admin/sections?courseId=<id>
 * Returns all sections for a course, each with its nested modules.
 */
export async function GET(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId")?.trim();

  if (!courseId) {
    return NextResponse.json(
      { error: "courseId is required." },
      { status: 400 },
    );
  }

  const { data: sections, error: sectionsError } =
    await authContext.supabaseAdmin
      .from("course_sections")
      .select("id, title, description, order_index, created_at")
      .eq("maincourse_id", courseId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

  if (sectionsError) {
    return NextResponse.json(
      { error: sectionsError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ sections: sections ?? [] });
}

/**
 * POST /api/admin/sections
 * Body: { courseId, title, description? }
 * Creates a new section for a course.
 */
export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const courseId =
    typeof body?.courseId === "string" || typeof body?.courseId === "number"
      ? String(body.courseId).trim()
      : "";
  const title =
    typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!courseId) {
    return NextResponse.json(
      { error: "courseId is required." },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json(
      { error: "Section title is required." },
      { status: 400 },
    );
  }

  // Determine the next order_index
  const { data: existingSections } = await authContext.supabaseAdmin
    .from("course_sections")
    .select("order_index")
    .eq("maincourse_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrderIndex =
    existingSections && existingSections.length > 0
      ? (existingSections[0].order_index ?? 0) + 1
      : 1;

  const { data: newSection, error: insertError } =
    await authContext.supabaseAdmin
      .from("course_sections")
      .insert({
        maincourse_id: courseId,
        title,
        description,
        order_index: nextOrderIndex,
      })
      .select("id, title, description, order_index, created_at")
      .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ section: newSection }, { status: 201 });
}

/**
 * PUT /api/admin/sections
 * Body: { id, title?, description?, order_index? }
 * Updates an existing section.
 */
export async function PUT(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const sectionId =
    typeof body?.id === "string" || typeof body?.id === "number"
      ? String(body.id).trim()
      : "";

  if (!sectionId) {
    return NextResponse.json(
      { error: "Section id is required." },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) {
    updatePayload.title = body.title.trim();
  }
  if (typeof body?.description === "string") {
    updatePayload.description = body.description.trim();
  }
  if (typeof body?.order_index === "number") {
    updatePayload.order_index = body.order_index;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 },
    );
  }

  updatePayload.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } =
    await authContext.supabaseAdmin
      .from("course_sections")
      .update(updatePayload)
      .eq("id", sectionId)
      .select("id, title, description, order_index, created_at, updated_at")
      .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ section: updated });
}

/**
 * DELETE /api/admin/sections?id=<sectionId>
 * Deletes a section. Modules in the section become ungrouped (section_id → NULL).
 */
export async function DELETE(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("id")?.trim();

  if (!sectionId) {
    return NextResponse.json(
      { error: "Section id is required." },
      { status: 400 },
    );
  }

  // The FK is ON DELETE SET NULL, so modules will automatically become ungrouped
  const { error: deleteError } = await authContext.supabaseAdmin
    .from("course_sections")
    .delete()
    .eq("id", sectionId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, sectionId });
}
