import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeScheduleType(value: unknown): "weekday" | "weekend" {
  return value === "weekend" ? "weekend" : "weekday";
}

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
  role: string | null;
};

function isAdminRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === "admin";
}

async function filterAssignableMemberEmails(
  supabaseAdmin: SupabaseClient,
  emails: string[],
): Promise<string[]> {
  if (emails.length === 0) return emails;

  const { data: profileRows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role");

  if (error) {
    throw new Error(error.message);
  }

  const authUsersResult =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authEmailById = new Map(
    (authUsersResult.data?.users ?? []).map((user) => [
      user.id,
      user.email?.trim().toLowerCase() ?? "",
    ]),
  );

  const adminEmails = new Set<string>();
  for (const row of (profileRows ?? []) as Pick<ProfileRow, "id" | "email" | "role">[]) {
    if (!isAdminRole(row.role)) continue;
    const email =
      row.email?.trim().toLowerCase() ||
      authEmailById.get(row.id) ||
      "";
    if (email) adminEmails.add(email);
  }

  return emails.filter((email) => !adminEmails.has(email.toLowerCase()));
}

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

type CourseEnrollmentRow = {
  user_id: string;
};

function normalizeBatchId(value: unknown): string | number | null {
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

type BatchWithRelations = {
  course_id?: string | number | null;
  batch_members?: BatchMemberRow[] | null;
  batch_courses?: BatchCourseRow[] | null;
};

function extractBatchAssignments(batch: BatchWithRelations) {
  const memberEmails = ((batch.batch_members ?? []) as BatchMemberRow[])
    .map((row) => row.email?.trim().toLowerCase() ?? "")
    .filter((email): email is string => Boolean(email));

  const courseIds = new Set<string>();
  for (const row of (batch.batch_courses ?? []) as BatchCourseRow[]) {
    if (row.course_id != null) {
      courseIds.add(String(row.course_id));
    }
  }
  if (batch.course_id != null) {
    courseIds.add(String(batch.course_id));
  }

  return {
    memberEmails,
    courseIds: Array.from(courseIds),
  };
}

async function getBatchAssignments(
  supabaseAdmin: SupabaseClient,
  batchId: string | number,
) {
  const { data: batchRow, error: batchError } = await supabaseAdmin
    .from("batches")
    .select(
      `
      course_id,
      batch_members (email),
      batch_courses (course_id)
    `,
    )
    .eq("id", batchId)
    .maybeSingle();

  if (batchError) {
    throw new Error(batchError.message);
  }

  if (!batchRow) {
    return { memberEmails: [], courseIds: [] };
  }

  return extractBatchAssignments(batchRow as BatchWithRelations);
}

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
    .select(
      `
      *,
      batch_members (email),
      batch_courses (course_id)
    `,
    )
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
      .select("id, email, full_name, role")
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
      role: row.role ?? null,
    }));
  }

  if (includeCourses) {
    // Only return active courses (not upcoming) for batch assignment
    const { data: courseRows, error: coursesError } = await authContext.supabaseAdmin
      .from("maincourses")
      .select("id, title, course_type")
      .order("created_at", { ascending: false });

    if (coursesError) {
      return NextResponse.json({ error: coursesError.message }, { status: 500 });
    }

    courses = ((courseRows ?? []) as (CourseRow & { course_type?: string | null })[]).filter(
      (course) => Boolean(course.title) && course.course_type !== "upcoming",
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

  const batchId = normalizeBatchId(batchIdParam);
  if (batchId === null) {
    return NextResponse.json({ error: "Invalid batchId." }, { status: 400 });
  }

  try {
    const assignment = await getBatchAssignments(authContext.supabaseAdmin, batchId);
    
    // Fetch profiles of all batch member emails
    const { data: memberProfiles } = await authContext.supabaseAdmin
      .from("profiles")
      .select("email, role")
      .in("email", assignment.memberEmails);

    const mentorEmails: string[] = [];
    const scholarEmails: string[] = [];

    const mentorSet = new Set(
      (memberProfiles ?? [])
        .filter((p) => p.role?.toLowerCase() === "instructor" || p.role?.toLowerCase() === "admin")
        .map((p) => p.email?.trim().toLowerCase())
        .filter(Boolean)
    );

    for (const email of assignment.memberEmails) {
      if (mentorSet.has(email.toLowerCase())) {
        mentorEmails.push(email);
      } else {
        scholarEmails.push(email);
      }
    }

    // Still filter the student scholars to avoid showing admins
    const filteredScholarEmails = await filterAssignableMemberEmails(
      authContext.supabaseAdmin,
      scholarEmails,
    );

    return NextResponse.json({
      success: true,
      batches: data ?? [],
      users,
      courses,
      assignment: {
        memberEmails: filteredScholarEmails,
        mentorEmails: mentorEmails,
        courseIds: assignment.courseIds,
      },
    });
  } catch (assignmentError) {
    return NextResponse.json(
      {
        error:
          assignmentError instanceof Error
            ? assignmentError.message
            : "Failed to load batch assignments.",
      },
      { status: 500 },
    );
  }
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
  const scheduleType = normalizeScheduleType(body?.schedule_type);

  // 1. Get the array of IDs sent from the frontend
  let assignedMembers = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  assignedMembers = await filterAssignableMemberEmails(
    authContext.supabaseAdmin,
    assignedMembers,
  );
  
  const assignedMentors = Array.isArray(body?.assigned_mentors)
    ? body.assigned_mentors
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];

  const assignedCourses = Array.isArray(body?.assigned_courses)
    ? body.assigned_courses
        .map((value: unknown) => normalizeCourseId(value))
        .filter((id: string | number | null): id is string | number => id !== null)
    : [];
  const selectedCourseId =
    assignedCourses.length > 0 ? assignedCourses[0] : null;

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
      schedule_type: scheduleType,
      course_id: selectedCourseId,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 3. Link the scholars & mentors to the batch
  const allMembers = [...assignedMembers, ...assignedMentors];
  if (allMembers.length > 0) {
    const junctionData = allMembers.map((memberEmail: string) => ({
      batch_id: batch.id,
      email: memberEmail,
    }));

    const { error: junctionError } = await authContext.supabaseAdmin
      .from("batch_members")
      .insert(junctionData);

    if (junctionError) {
      console.error("Link Error:", junctionError.message);
      return NextResponse.json(
        { error: "Failed to link members" },
        { status: 500 },
      );
    }
  }

  // 4. Link courses to the batch via batch_courses junction table
  if (assignedCourses.length > 0) {
    const batchCoursesData = assignedCourses.map((courseId: string | number) => ({
      batch_id: batch.id,
      course_id: courseId,
    }));

    const { error: batchCoursesError } = await authContext.supabaseAdmin
      .from("batch_courses")
      .insert(batchCoursesData);

    if (batchCoursesError) {
      console.error("Batch Courses Link Error:", batchCoursesError.message);
      return NextResponse.json(
        { error: "Failed to link courses" },
        { status: 500 },
      );
    }
  }

  // 5. Enroll the scholars in all assigned courses
  if (assignedCourses.length > 0 && assignedMembers.length > 0) {
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
      // Enroll in all courses
      for (const courseId of assignedCourses) {
        const { data: existing } = await authContext.supabaseAdmin
          .from("course_enrollments")
          .select("user_id")
          .eq("course_id", courseId)
          .in("user_id", userIdsToEnroll);
          
        const existingUserIds = new Set(
          ((existing ?? []) as CourseEnrollmentRow[]).map((e) => e.user_id),
        );
        
        const newEnrollments = userIdsToEnroll
          .filter(id => !existingUserIds.has(id))
          .map(id => ({
            user_id: id,
            course_id: courseId,
          }));
          
        if (newEnrollments.length > 0) {
          const { error: enrollError } = await authContext.supabaseAdmin
            .from("course_enrollments")
            .insert(newEnrollments);
            
          if (enrollError) {
            console.error(`Enrollment Error for course ${courseId}:`, enrollError.message);
          }
        }
      }
    }
  }

  const { data: createdBatch, error: reloadError } = await authContext.supabaseAdmin
    .from("batches")
    .select(
      `
      *,
      batch_members (email),
      batch_courses (course_id)
    `,
    )
    .eq("id", batch.id)
    .single();

  if (reloadError) {
    return NextResponse.json({ success: true, batch });
  }

  return NextResponse.json({ success: true, batch: createdBatch });
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
  const scheduleType = normalizeScheduleType(body?.schedule_type);
  const startDate =
    typeof body?.start_date === "string" ? body.start_date.trim() : "";

  let assignedMembers = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  assignedMembers = await filterAssignableMemberEmails(
    authContext.supabaseAdmin,
    assignedMembers,
  );

  const assignedMentors = Array.isArray(body?.assigned_mentors)
    ? body.assigned_mentors
        .map((value: unknown) =>
          typeof value === "string" ? value.trim().toLowerCase() : "",
        )
        .filter((email: string) => EMAIL_RE.test(email))
    : [];

  const assignedCourses = Array.isArray(body?.assigned_courses)
    ? body.assigned_courses
        .map((value: unknown) => normalizeCourseId(value))
        .filter((id: string | number | null): id is string | number => id !== null)
    : [];
  const selectedCourseId =
    assignedCourses.length > 0 ? assignedCourses[0] : null;

  if (typeof id === "string" && !id) {
    return NextResponse.json(
      { error: "A valid batch id is required." },
      { status: 400 },
    );
  }

  // Derive name and description from the parent course when possible
  let batchName = typeof body?.name === "string" ? body.name.trim() : "";
  let batchDescription = typeof body?.description === "string" ? body.description.trim() : "";

  if (selectedCourseId) {
    const { data: courseRow } = await authContext.supabaseAdmin
      .from("maincourses")
      .select("title, description")
      .eq("id", selectedCourseId)
      .maybeSingle();

    if (courseRow) {
      // Re-generate name if not provided by frontend
      if (!batchName && courseRow.title && startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) {
          const month = d.toLocaleString("en-US", { month: "long" });
          const year = d.getFullYear();
          const scheduleLabel = scheduleType === "weekend" ? "Weekend" : "Weekday";
          batchName = `${courseRow.title} ${month} ${year} ${scheduleLabel} Batch`;
        }
      }
      if (!batchDescription) {
        batchDescription = courseRow.description ?? "";
      }
    }
  }

  // Final fallback — keep existing name/description if still empty
  if (!batchName) {
    const { data: existing } = await authContext.supabaseAdmin
      .from("batches")
      .select("name, description")
      .eq("id", id)
      .maybeSingle();
    if (existing?.name) batchName = existing.name;
    if (!batchDescription && existing?.description) batchDescription = existing.description;
  }

  const { error: updateError } = await authContext.supabaseAdmin
    .from("batches")
    .update({
      name: batchName,
      description: batchDescription,
      start_date: startDate || null,
      schedule_type: scheduleType,
      course_id: selectedCourseId,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Clear and re-insert batch members
  const { error: clearMembersError } = await authContext.supabaseAdmin
    .from("batch_members")
    .delete()
    .eq("batch_id", id);

  if (clearMembersError) {
    return NextResponse.json({ error: clearMembersError.message }, { status: 500 });
  }

  const allMembers = [...assignedMembers, ...assignedMentors];
  if (allMembers.length > 0) {
    const memberRows = allMembers.map((memberEmail: string) => ({
      batch_id: id,
      email: memberEmail,
    }));
    const { error: insertMembersError } = await authContext.supabaseAdmin
      .from("batch_members")
      .insert(memberRows);
    if (insertMembersError) {
      return NextResponse.json({ error: insertMembersError.message }, { status: 500 });
    }
  }

  // Clear and re-insert batch courses
  const { error: clearCoursesError } = await authContext.supabaseAdmin
    .from("batch_courses")
    .delete()
    .eq("batch_id", id);

  if (clearCoursesError) {
    return NextResponse.json({ error: clearCoursesError.message }, { status: 500 });
  }

  if (assignedCourses.length > 0) {
    const batchCoursesData = assignedCourses.map((courseId: string | number) => ({
      batch_id: id,
      course_id: courseId,
    }));

    const { error: insertCoursesError } = await authContext.supabaseAdmin
      .from("batch_courses")
      .insert(batchCoursesData);

    if (insertCoursesError) {
      return NextResponse.json({ error: insertCoursesError.message }, { status: 500 });
    }
  }

  // Enroll members in all courses
  if (assignedCourses.length > 0 && assignedMembers.length > 0) {
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
      // Enroll in all courses
      for (const courseId of assignedCourses) {
        const { data: existing } = await authContext.supabaseAdmin
          .from("course_enrollments")
          .select("user_id")
          .eq("course_id", courseId)
          .in("user_id", userIdsToEnroll);
          
        const existingUserIds = new Set(
          ((existing ?? []) as CourseEnrollmentRow[]).map((e) => e.user_id),
        );
        
        const newEnrollments = userIdsToEnroll
          .filter(id => !existingUserIds.has(id))
          .map(id => ({
            user_id: id,
            course_id: courseId,
          }));
          
        if (newEnrollments.length > 0) {
          const { error: enrollError } = await authContext.supabaseAdmin
            .from("course_enrollments")
            .insert(newEnrollments);
            
          if (enrollError) {
            console.error(`Enrollment Error for course ${courseId}:`, enrollError.message);
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

  const { error: deleteCoursesError } = await authContext.supabaseAdmin
    .from("batch_courses")
    .delete()
    .eq("batch_id", id);

  if (deleteCoursesError) {
    return NextResponse.json({ error: deleteCoursesError.message }, { status: 500 });
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
