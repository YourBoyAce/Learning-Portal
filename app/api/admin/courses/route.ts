import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeId(value: unknown): string | number | null {
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

async function attachBatchNamesToCourses(
  supabaseAdmin: SupabaseClient,
  courses: Array<{ id: string | number }>,
) {
  if (courses.length === 0) return courses;

  const courseIds = courses.map((course) => course.id);
  const infoByCourseId = new Map<
    string,
    {
      names: string[];
      scheduleTypes: Set<"weekday" | "weekend">;
      startDate: string | null;
    }
  >();

  const addBatchToCourse = (
    courseId: unknown,
    batch: {
      name?: string | null;
      schedule_type?: unknown;
      start_date?: string | null;
    },
  ) => {
    if (courseId == null || typeof batch.name !== "string" || !batch.name.trim()) {
      return;
    }

    const key = String(courseId);
    const info = infoByCourseId.get(key) ?? {
      names: [],
      scheduleTypes: new Set<"weekday" | "weekend">(),
      startDate: null,
    };

    if (!info.names.includes(batch.name)) {
      info.names.push(batch.name);
    }

    info.scheduleTypes.add(
      batch.schedule_type === "weekend" ? "weekend" : "weekday",
    );

    if (batch.start_date && !info.startDate) {
      info.startDate = batch.start_date;
    }

    infoByCourseId.set(key, info);
  };

  const { data: directBatches } = await supabaseAdmin
    .from("batches")
    .select("name, course_id, schedule_type, start_date")
    .in("course_id", courseIds);

  for (const batch of directBatches ?? []) {
    addBatchToCourse(batch.course_id, batch);
  }

  const { data: batchCourses } = await supabaseAdmin
    .from("batch_courses")
    .select("course_id, batch_id")
    .in("course_id", courseIds);

  const junctionBatchIds = [
    ...new Set(
      (batchCourses ?? [])
        .map((row) => row.batch_id)
        .filter((id): id is string | number => id != null),
    ),
  ];

  if (junctionBatchIds.length > 0) {
    const { data: junctionBatches } = await supabaseAdmin
      .from("batches")
      .select("id, name, schedule_type, start_date")
      .in("id", junctionBatchIds);

    const batchById = new Map(
      (junctionBatches ?? []).map((batch) => [String(batch.id), batch]),
    );

    for (const row of batchCourses ?? []) {
      const batch = batchById.get(String(row.batch_id));
      if (batch) {
        addBatchToCourse(row.course_id, batch);
      }
    }
  }

  return courses.map((course) => {
    const info = infoByCourseId.get(String(course.id));
    return {
      ...course,
      batch_name: info?.names.join(", ") || null,
      batch_schedule_types: info
        ? Array.from(info.scheduleTypes)
        : [],
      batch_start_date: info?.startDate ?? null,
    };
  });
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

  const coursesWithBatches = await attachBatchNamesToCourses(
    authContext.supabaseAdmin,
    data ?? [],
  );

  return NextResponse.json(
    { success: true, courses: coursesWithBatches },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// export async function POST(request: Request) {
//   const authContext = await authenticateAdmin(request);
//   if ("error" in authContext) {
//     return authContext.error;
//   }

//   const body = await request.json().catch(() => null);
//   const title = typeof body?.title === "string" ? body.title.trim() : "";
//   const description =
//     typeof body?.description === "string" ? body.description.trim() : "";
//   const thumbnailUrl =
//     typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;

//   if (!title || !description) {
//     return NextResponse.json(
//       { error: "Title and description are required." },
//       { status: 400 },
//     );
//   }

//   const { data: newCourse, error: insertError } = await authContext.supabaseAdmin
//     .from("maincourses")
//     .insert({
//       title,
//       description,
//       ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
//     })
//     .select("id")
//     .single();

//   if (insertError) {
//     return NextResponse.json({ error: insertError.message }, { status: 500 });
//   }

//   const modules = Array.isArray(body?.modules) ? body.modules : [];
//   if (modules.length > 0) {
//     const modulesToInsert = modules
//       .map((m: any, index: number) => ({
//         maincourse_id: newCourse.id,
//         title: typeof m.title === "string" ? m.title.trim() : "",
//         description: typeof m.description === "string" ? m.description.trim() : "",
//         order_index: index + 1,
//       }))
//       .filter((m: any) => m.title !== "");

//     if (modulesToInsert.length > 0) {
//       const { error: modulesError } = await authContext.supabaseAdmin
//         .from("coursemodules")
//         .insert(modulesToInsert);

//       if (modulesError) {
//         return NextResponse.json(
//           {
//             error:
//               "Course created but failed to add modules: " +
//               modulesError.message,
//           },
//           { status: 500 },
//         );
//       }
//     }
//   }

//   return NextResponse.json({ success: true });
// }

// export async function PUT(request: Request) {
//   const authContext = await authenticateAdmin(request);
//   if ("error" in authContext) {
//     return authContext.error;
//   }

//   const body = await request.json().catch(() => null);
//   const id = normalizeId(body?.id);
//   const title = typeof body?.title === "string" ? body.title.trim() : "";
//   const description =
//     typeof body?.description === "string" ? body.description.trim() : "";

//   // Check if thumbnail_url field was explicitly provided (including null)
//   const hasThumbnailField = "thumbnail_url" in (body || {});
//   const thumbnailUrl =
//     typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : (hasThumbnailField ? null : undefined);

//   if (id === null || !title || !description) {
//     return NextResponse.json(
//       { error: "id, title and description are required." },
//       { status: 400 },
//     );
//   }

//   const { error: updateError } = await authContext.supabaseAdmin
//     .from("maincourses")
//     .update({ title, description, ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }) })
//     .eq("id", id);

//   if (updateError) {
//     return NextResponse.json({ error: updateError.message }, { status: 500 });
//   }

//   const modules = body?.modules;
//   if (Array.isArray(modules)) {
//     const validModules = modules.filter(
//       (m: any) => m && typeof m.title === "string" && m.title.trim() !== ""
//     );

//     const modulesToUpdate = validModules.filter((m: any) => m.id);
//     const modulesToInsert = validModules.filter((m: any) => !m.id);
//     const moduleOrderMap = new Map<any, number>();
//     validModules.forEach((m: any, index: number) => {
//       if (m.id) moduleOrderMap.set(m.id, index + 1);
//     });

//     const keepIds = modulesToUpdate.map((m: any) => m.id);

//     // Fetch all current module IDs for the course
//     const { data: currentModules, error: fetchError } = await authContext.supabaseAdmin
//       .from("coursemodules")
//       .select("id")
//       .eq("maincourse_id", id);

//     if (fetchError) {
//       return NextResponse.json(
//         { error: "Course updated but failed to check existing modules: " + fetchError.message },
//         { status: 500 },
//       );
//     }

//     const currentIds = currentModules?.map((m: any) => m.id) ?? [];
//     const deleteIds = currentIds.filter((cid: string) => !keepIds.includes(cid));

//     if (deleteIds.length > 0) {
//       const { error: deleteModulesError } = await authContext.supabaseAdmin
//         .from("coursemodules")
//         .delete()
//         .in("id", deleteIds);

//       if (deleteModulesError) {
//         return NextResponse.json(
//           { error: "Course updated but failed to remove modules: " + deleteModulesError.message },
//           { status: 500 },
//         );
//       }
//     }

//     // Update existing modules
//     for (const mod of modulesToUpdate) {
//       const { error: modUpdateError } = await authContext.supabaseAdmin
//         .from("coursemodules")
//         .update({
//           title: mod.title.trim(),
//           description: (mod.description || "").trim(),
//           order_index: moduleOrderMap.get(mod.id) ?? null,
//         })
//         .eq("id", mod.id)
//         .eq("maincourse_id", id);

//       if (modUpdateError) {
//         return NextResponse.json(
//           { error: "Course updated but failed to update modules: " + modUpdateError.message },
//           { status: 500 },
//         );
//       }
//     }

//     // Insert new modules
//     if (modulesToInsert.length > 0) {
//       const insertData = modulesToInsert.map((mod: any) => {
//         const orderIndex =
//           validModules.findIndex((m: any) => m === mod) + 1;
//         return {
//         maincourse_id: id,
//         title: mod.title.trim(),
//         description: (mod.description || "").trim(),
//         order_index: orderIndex > 0 ? orderIndex : null,
//       };
//       });

//       const { error: insertModulesError } = await authContext.supabaseAdmin
//         .from("coursemodules")
//         .insert(insertData);

//       if (insertModulesError) {
//         return NextResponse.json(
//           { error: "Course updated but failed to insert new modules: " + insertModulesError.message },
//           { status: 500 },
//         );
//       }
//     }
//   }

//   return NextResponse.json({ success: true });
// }
export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const thumbnailUrl =
    typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;
  const courseType = body?.course_type; // Extract course_type from frontend payload

  // 1. Conditional Validation
  if (!title) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 },
    );
  }

  if (courseType !== "upcoming" && !description) {
    return NextResponse.json(
      { error: "Description is required for active courses." },
      { status: 400 },
    );
  }

  const { data: newCourse, error: insertError } = await authContext.supabaseAdmin
    .from("maincourses")
    .insert({
      title,
      // Pass null explicitly if it's an upcoming course to keep the DB clean
      description: courseType === "upcoming" ? null : description,
      ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
      // Optional: Save course_type if you have a column for it in your DB
      ...(courseType && { course_type: courseType })
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const modules = Array.isArray(body?.modules) ? body.modules : [];
  if (modules.length > 0 && courseType !== "upcoming") {
    const modulesToInsert = modules
      .map((m: any, index: number) => ({
        maincourse_id: newCourse.id,
        title: typeof m.title === "string" ? m.title.trim() : "",
        description: typeof m.description === "string" ? m.description.trim() : "",
        order_index: index + 1,
      }))
      .filter((m: any) => m.title !== "");

    if (modulesToInsert.length > 0) {
      const { error: modulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .insert(modulesToInsert);

      if (modulesError) {
        return NextResponse.json(
          {
            error:
              "Course created but failed to add modules: " +
              modulesError.message,
          },
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
  const id = normalizeId(body?.id);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const courseType = body?.course_type; // Extract course_type from frontend payload

  // Check if thumbnail_url field was explicitly provided (including null)
  const hasThumbnailField = "thumbnail_url" in (body || {});
  const thumbnailUrl =
    typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : (hasThumbnailField ? null : undefined);

  // 1. Conditional Validation
  if (id === null || !title) {
    return NextResponse.json(
      { error: "id and title are required." },
      { status: 400 },
    );
  }

  if (courseType !== "upcoming" && !description) {
    return NextResponse.json(
      { error: "Description is required for active courses." },
      { status: 400 },
    );
  }

  const { error: updateError } = await authContext.supabaseAdmin
    .from("maincourses")
    .update({
      title,
      description: courseType === "upcoming" ? null : description,
      ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
      ...(courseType && { course_type: courseType })
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const modules = body?.modules;
  // Only process modules if it's an active course
  if (Array.isArray(modules) && courseType !== "upcoming") {
    const validModules = modules.filter(
      (m: any) => m && typeof m.title === "string" && m.title.trim() !== ""
    );

    const modulesToUpdate = validModules.filter((m: any) => m.id);
    const modulesToInsert = validModules.filter((m: any) => !m.id);
    const moduleOrderMap = new Map<any, number>();
    validModules.forEach((m: any, index: number) => {
      if (m.id) moduleOrderMap.set(m.id, index + 1);
    });

    const keepIds = modulesToUpdate.map((m: any) => m.id);

    // Fetch all current module IDs for the course
    const { data: currentModules, error: fetchError } = await authContext.supabaseAdmin
      .from("coursemodules")
      .select("id")
      .eq("maincourse_id", id);

    if (fetchError) {
      return NextResponse.json(
        { error: "Course updated but failed to check existing modules: " + fetchError.message },
        { status: 500 },
      );
    }

    const currentIds = currentModules?.map((m: any) => m.id) ?? [];
    const deleteIds = currentIds.filter((cid: string) => !keepIds.includes(cid));

    if (deleteIds.length > 0) {
      const { error: deleteModulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .delete()
        .in("id", deleteIds);

      if (deleteModulesError) {
        return NextResponse.json(
          { error: "Course updated but failed to remove modules: " + deleteModulesError.message },
          { status: 500 },
        );
      }
    }

    // Update existing modules
    for (const mod of modulesToUpdate) {
      const { error: modUpdateError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .update({
          title: mod.title.trim(),
          description: (mod.description || "").trim(),
          order_index: moduleOrderMap.get(mod.id) ?? null,
        })
        .eq("id", mod.id)
        .eq("maincourse_id", id);

      if (modUpdateError) {
        return NextResponse.json(
          { error: "Course updated but failed to update modules: " + modUpdateError.message },
          { status: 500 },
        );
      }
    }

    // Insert new modules
    if (modulesToInsert.length > 0) {
      const insertData = modulesToInsert.map((mod: any) => {
        const orderIndex =
          validModules.findIndex((m: any) => m === mod) + 1;
        return {
          maincourse_id: id,
          title: mod.title.trim(),
          description: (mod.description || "").trim(),
          order_index: orderIndex > 0 ? orderIndex : null,
        };
      });

      const { error: insertModulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .insert(insertData);

      if (insertModulesError) {
        return NextResponse.json(
          { error: "Course updated but failed to insert new modules: " + insertModulesError.message },
          { status: 500 },
        );
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
  const id = normalizeId(rawId);

  if (id === null) {
    return NextResponse.json(
      { error: "Valid course id is required." },
      { status: 400 },
    );
  }

  // Detach from batches
  await authContext.supabaseAdmin
    .from("batches")
    .update({ course_id: null })
    .eq("course_id", id);

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

  const { error: deleteError } = await authContext.supabaseAdmin
    .from("maincourses")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
