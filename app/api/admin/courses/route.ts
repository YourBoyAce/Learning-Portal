import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AuthContext =
  | { error: NextResponse }
  | {
    token: string;
    userId: string;
    supabaseAdmin: SupabaseClient<any, "public", any>;
  };

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

  if (profileError || profile?.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    token,
    userId: authData.user.id,
    supabaseAdmin,
  };
}

export async function GET(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const { data, error } = await authContext.supabaseAdmin
    .from("maincourses")
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, courses: data ?? [] });
}

export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!title || !description) {
    return NextResponse.json(
      { error: "Title and description are required." },
      { status: 400 },
    );
  }

  const { data: newCourse, error: insertError } = await authContext.supabaseAdmin
    .from("maincourses")
    .insert({
      title,
      description,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const modules = Array.isArray(body?.modules) ? body.modules : [];
  if (modules.length > 0) {
    const modulesToInsert = modules
      .map((m: any) => ({
        maincourse_id: newCourse.id,
        title: typeof m.title === "string" ? m.title.trim() : "",
      }))
      .filter((m: any) => m.title !== "");

    if (modulesToInsert.length > 0) {
      const { error: modulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .insert(modulesToInsert);

      if (modulesError) {
        return NextResponse.json(
          { error: "Course created but failed to add modules: " + modulesError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!id || !title || !description) {
    return NextResponse.json(
      { error: "ID, title, and description are required." },
      { status: 400 },
    );
  }

  const { error } = await authContext.supabaseAdmin
    .from("maincourses")
    .update({ title, description })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Course ID is required." }, { status: 400 });
  }

  // Handle cascading deletions manually if not set in DB
  // Delete modules first
  await authContext.supabaseAdmin
    .from("coursemodules")
    .delete()
    .eq("maincourse_id", id);

  // Delete enrollments, ratings, progress, certificates (though these usually have ON DELETE CASCADE)
  await authContext.supabaseAdmin
    .from("user_video_progress")
    .delete()
    .eq("course_id", id);
    
  await authContext.supabaseAdmin
    .from("course_enrollments")
    .delete()
    .eq("course_id", id);
    
  await authContext.supabaseAdmin
    .from("course_ratings")
    .delete()
    .eq("course_id", id);
    
  await authContext.supabaseAdmin
    .from("certificates")
    .delete()
    .eq("course_id", id);

  const { error } = await authContext.supabaseAdmin
    .from("maincourses")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
