import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeCourseId(value: unknown): string | number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) && String(asNumber) === trimmed
      ? asNumber
      : trimmed;
  }
  return null;
}

type AuthContext =
  | { error: NextResponse }
  | {
      token: string;
      userId: string;
      supabaseAdmin: SupabaseClient;
    };

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type CourseRow = {
  id: string | number;
  title: string;
};

type BatchMemberRow = {
  email: string | null;
};

type BatchCourseRow = {
  course_id: string | number | null;
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
  }) as unknown as SupabaseClient;

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

  const { searchParams } = new URL(request.url);
  const includeUsers = searchParams.get("includeUsers") === "true";
  const includeCourses = searchParams.get("includeCourses") === "true";
  const includeAssignments = searchParams.get("includeAssignments") === "true";
  const batchIdParam = searchParams.get("batchId");

  const { data, error } = await authContext.supabaseAdmin
    .from("batches")
    .select("*")
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!includeUsers && !includeCourses && !includeAssignments) {
    return NextResponse.json({ success: true, batches: data ?? [] });
  }

  let users: ProfileRow[] = [];
  let courses: CourseRow[] = [];

  if (includeUsers) {
    const { data: profileRows, error: usersError } = await authContext.supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .order("created_at", { ascending: false });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const authUsersResult =
      await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

    const authEmailById = new Map(
      (authUsersResult.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    users = ((profileRows ?? []) as ProfileRow[]).map((row) => ({
      id: row.id,
      full_name: row.full_name ?? null,
      email: row.email ?? authEmailById.get(row.id) ?? null,
    }));
  }

  if (includeCourses) {
    const { data: courseRows, error: coursesError } = await authContext.supabaseAdmin
      .from("maincourses")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (coursesError) {
      return NextResponse.json({ error: coursesError.message }, { status: 500 });
    }

    courses = ((courseRows ?? []) as CourseRow[]).filter((course) =>
      Boolean(course.title),
    );
  }

  if (!includeAssignments || !batchIdParam) {
    return NextResponse.json({
      success: true,
      batches: data ?? [],
      users,
      courses,
    });
  }

  const batchId = Number(batchIdParam);
  if (!Number.isFinite(batchId)) {
    return NextResponse.json({ error: "Invalid batchId." }, { status: 400 });
  }

  const { data: memberRows, error: membersError } = await authContext.supabaseAdmin
    .from("batch_members")
    .select("email")
    .eq("batch_id", batchId);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const { data: batchRow, error: batchRowError } = await authContext.supabaseAdmin
    .from("batches")
    .select("course_id")
    .eq("id", batchId)
    .maybeSingle();

  if (batchRowError) {
    return NextResponse.json({ error: batchRowError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    batches: data ?? [],
    users,
    courses,
    assignment: {
      memberEmails: ((memberRows ?? []) as BatchMemberRow[])
        .map((row) => row.email)
        .filter((email): email is string => Boolean(email)),
      courseIds: (batchRow as BatchCourseRow | null)?.course_id
        ? [String((batchRow as BatchCourseRow).course_id)]
        : [],
    },
  });
}

export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const startDate =
    typeof body?.start_date === "string" ? body.start_date.trim() : "";

  // 1. Get the array of IDs sent from the frontend
  const assignedMembers = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  const assignedCourses = Array.isArray(body?.assigned_courses)
    ? body.assigned_courses
    : [];
  const selectedCourseId =
    assignedCourses.length > 0 ? normalizeCourseId(assignedCourses[0]) : null;

  if (!name || !description) {
    return NextResponse.json(
      { error: "Name and description are required." },
      { status: 400 },
    );
  }

  // 2. Create the Batch
  const { data: batch, error: insertError } = await authContext.supabaseAdmin
    .from("batches")
    .insert({
      name,
      description,
      start_date: startDate || null,
      course_id: selectedCourseId,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 3. Link the scholars to the batch
  if (assignedMembers.length > 0) {
    const junctionData = assignedMembers.map((memberEmail: string) => ({
      batch_id: batch.id, // This comes from the 'batch' we just created above
      email: memberEmail, // Persist selected email as per schema
    }));

    const { error: junctionError } = await authContext.supabaseAdmin
      .from("batch_members") // Make sure this table exists in Supabase!
      .insert(junctionData);

    if (junctionError) {
      console.error("Link Error:", junctionError.message);
      return NextResponse.json(
        { error: "Failed to link members" },
        { status: 500 },
      );
    }
    
    // 4. Enroll the scholars in the assigned course
    if (selectedCourseId) {
      const authUsersResult = await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUsers = authUsersResult.data?.users ?? [];
      
      const userIdsToEnroll: string[] = [];
      for (const email of assignedMembers) {
        const authUser = authUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (authUser) {
          userIdsToEnroll.push(authUser.id);
        }
      }

      if (userIdsToEnroll.length > 0) {
        const { data: existing } = await authContext.supabaseAdmin
          .from("course_enrollments")
          .select("user_id")
          .eq("course_id", selectedCourseId)
          .in("user_id", userIdsToEnroll);
          
        const existingUserIds = new Set(existing?.map((e: any) => e.user_id) || []);
        
        const newEnrollments = userIdsToEnroll
          .filter(id => !existingUserIds.has(id))
          .map(id => ({
            user_id: id,
            course_id: selectedCourseId,
          }));
          
        if (newEnrollments.length > 0) {
          const { error: enrollError } = await authContext.supabaseAdmin
            .from("course_enrollments")
            .insert(newEnrollments);
            
          if (enrollError) {
             console.error("Enrollment Error:", enrollError.message);
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, batch });
}

export async function PUT(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const rawId = body?.id;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? rawId.trim()
        : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const startDate =
    typeof body?.start_date === "string" ? body.start_date.trim() : "";
  const assignedMembers = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  const assignedCourses = Array.isArray(body?.assigned_courses)
    ? body.assigned_courses.map(String)
    : [];
  const selectedCourseId =
    assignedCourses.length > 0 ? normalizeCourseId(assignedCourses[0]) : null;

  if ((typeof id === "string" && !id) || !name || !description) {
    return NextResponse.json(
      { error: "id, name and description are required." },
      { status: 400 },
    );
  }

  const { error: updateError } = await authContext.supabaseAdmin
    .from("batches")
    .update({
      name,
      description,
      start_date: startDate || null,
      course_id: selectedCourseId,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: clearMembersError } = await authContext.supabaseAdmin
    .from("batch_members")
    .delete()
    .eq("batch_id", id);

  if (clearMembersError) {
    return NextResponse.json({ error: clearMembersError.message }, { status: 500 });
  }

  if (assignedMembers.length > 0) {
    const memberRows = assignedMembers.map((memberEmail: string) => ({
      batch_id: id,
      email: memberEmail,
    }));
    const { error: insertMembersError } = await authContext.supabaseAdmin
      .from("batch_members")
      .insert(memberRows);
    if (insertMembersError) {
      return NextResponse.json({ error: insertMembersError.message }, { status: 500 });
    }
    
    // Enroll the scholars in the assigned course
    if (selectedCourseId) {
      const authUsersResult = await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUsers = authUsersResult.data?.users ?? [];
      
      const userIdsToEnroll: string[] = [];
      for (const email of assignedMembers) {
        const authUser = authUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (authUser) {
          userIdsToEnroll.push(authUser.id);
        }
      }

      if (userIdsToEnroll.length > 0) {
        const { data: existing } = await authContext.supabaseAdmin
          .from("course_enrollments")
          .select("user_id")
          .eq("course_id", selectedCourseId)
          .in("user_id", userIdsToEnroll);
          
        const existingUserIds = new Set(existing?.map((e: any) => e.user_id) || []);
        
        const newEnrollments = userIdsToEnroll
          .filter(id => !existingUserIds.has(id))
          .map(id => ({
            user_id: id,
            course_id: selectedCourseId,
          }));
          
        if (newEnrollments.length > 0) {
          const { error: enrollError } = await authContext.supabaseAdmin
            .from("course_enrollments")
            .insert(newEnrollments);
            
          if (enrollError) {
             console.error("Enrollment Error:", enrollError.message);
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const { searchParams } = new URL(request.url);
  const rawId = body?.id ?? searchParams.get("id");
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? rawId.trim()
        : "";

  if (id === "" || id === null || id === undefined) {
    return NextResponse.json(
      { error: "Valid batch id is required." },
      { status: 400 },
    );
  }

  const { error: deleteMembersError } = await authContext.supabaseAdmin
    .from("batch_members")
    .delete()
    .eq("batch_id", id);

  if (deleteMembersError) {
    return NextResponse.json({ error: deleteMembersError.message }, { status: 500 });
  }

  const { error: deleteBatchError } = await authContext.supabaseAdmin
    .from("batches")
    .delete()
    .eq("id", id);

  if (deleteBatchError) {
    return NextResponse.json({ error: deleteBatchError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
