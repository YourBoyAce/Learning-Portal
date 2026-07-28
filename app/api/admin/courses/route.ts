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

  // Fetch active maincourses
  const { data: maincoursesData, error: maincoursesError } = await authContext.supabaseAdmin
    .from("maincourses")
    .select("*");

  if (maincoursesError) {
    return NextResponse.json({ error: maincoursesError.message }, { status: 500 });
  }

  // Fetch products (represent "upcoming" planned offerings)
  const { data: productsData, error: productsError } = await authContext.supabaseAdmin
    .from("products")
    .select("id, title, description, thumbnail_url, created_at")
    .order("created_at", { ascending: false });

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  // Products that already have a linked maincourse are "active" — don't show them in upcoming.
  // Determine which product_ids already have a maincourse
  const linkedProductIds = new Set(
    ((maincoursesData ?? []) as any[])
      .map((c) => c.product_id)
      .filter(Boolean)
      .map(String),
  );

  // Products with no linked maincourse = upcoming (planned, not yet built)
  const upcomingProducts = ((productsData ?? []) as any[])
    .filter((p) => !linkedProductIds.has(String(p.id)))
    .map((p) => ({
      ...p,
      course_type: "upcoming",
      _source: "product", // sentinel so frontend can distinguish
    }));

  // Enrich maincourses with batch names
  const coursesWithBatches = await attachBatchNamesToCourses(
    authContext.supabaseAdmin,
    maincoursesData ?? [],
  );

  // Return merged: active maincourses + upcoming products
  const courses = [
    ...((coursesWithBatches as any[]).map((c) => ({ ...c, _source: "maincourse" }))),
    ...upcomingProducts,
  ];

  return NextResponse.json(
    { success: true, courses },
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
  const courseType: string = body?.course_type ?? "active";
  const thumbnailUrl =
    typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;

  // ── WORKFLOW 1: Upcoming → insert into products only ──────────────────────
  if (courseType === "upcoming") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const { error: productError } = await authContext.supabaseAdmin
      .from("products")
      .insert({ title, description: description || null, thumbnail_url: thumbnailUrl || null });

    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── WORKFLOW 2: Active → product + maincourse + modules ───────────────────
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required for active courses." }, { status: 400 });
  }

  // Step 1: Resolve or create product
  let productId: number | string | null = null;
  const existingProductId = body?.product_id ?? null;
  const newProductTitle = typeof body?.new_product_title === "string" ? body.new_product_title.trim() : "";
  const newProductDescription = typeof body?.new_product_description === "string" ? body.new_product_description.trim() : "";
  const newProductThumbnail = typeof body?.new_product_thumbnail === "string" ? body.new_product_thumbnail.trim() : null;

  if (existingProductId) {
    // Reuse the chosen product
    productId = existingProductId;
  } else if (newProductTitle) {
    // Create a new product first
    const { data: createdProduct, error: productInsertError } = await authContext.supabaseAdmin
      .from("products")
      .insert({
        title: newProductTitle,
        description: newProductDescription || null,
        thumbnail_url: newProductThumbnail || null,
      })
      .select("id")
      .single();

    if (productInsertError) {
      return NextResponse.json({ error: "Failed to create product: " + productInsertError.message }, { status: 500 });
    }
    productId = createdProduct.id;
  }
  // productId can remain null if no product selected — backward compatible

  // Step 2: Build internal maincourse title from product + month + schedule
  let internalTitle: string;
  const productTitle = body?.product_title as string | undefined;
  const month = typeof body?.month === "string" ? body.month.trim() : "";
  const scheduleLabel = body?.schedule === "weekend" ? "Weekend" : "Weekday";

  if (productTitle && month) {
    internalTitle = `${productTitle} - ${month} ${scheduleLabel}`;
  } else if (typeof body?.title === "string" && body.title.trim()) {
    // Fallback: explicit title provided (edit case / legacy)
    internalTitle = body.title.trim();
  } else {
    return NextResponse.json({ error: "Product and month are required to generate the course title." }, { status: 400 });
  }

  // Step 3: Insert maincourse
  const { data: newCourse, error: insertError } = await authContext.supabaseAdmin
    .from("maincourses")
    .insert({
      title: internalTitle,
      description,
      thumbnail_url: thumbnailUrl || null,
      course_type: "active",
      ...(productId !== null && { product_id: productId }),
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Step 4: Insert modules
  const modules = Array.isArray(body?.modules) ? body.modules : [];
  if (modules.length > 0) {
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
          { error: "Course created but failed to add modules: " + modulesError.message },
          { status: 500 },
        );
      }
    }
  }

  // Step 5: Automatically create the corresponding batch
  // Batch name follows the existing format: "<ProductTitle> <Month> <ScheduleLabel> Batch"
  const batchScheduleType: "weekday" | "weekend" =
    body?.schedule === "weekend" ? "weekend" : "weekday";
  const batchScheduleLabel = batchScheduleType === "weekend" ? "Weekend" : "Weekday";
  const batchName = productTitle && month
    ? `${productTitle} ${month} ${batchScheduleLabel} Batch`
    : internalTitle;

  const startDate = typeof body?.start_date === "string" ? body.start_date.trim() : null;

  const { error: batchInsertError } = await authContext.supabaseAdmin
    .from("batches")
    .insert({
      name: batchName,
      description,
      start_date: startDate || null,
      schedule_type: batchScheduleType,
      course_id: newCourse.id,
    });

  if (batchInsertError) {
    // Batch creation failure is non-fatal — course + modules are already saved
    console.error("Auto-batch creation failed:", batchInsertError.message);
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const body = await request.json().catch(() => null);
  const courseType: string = body?.course_type ?? "active";
  const thumbnailUrl =
    typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : undefined;
  const hasThumbnailField = "thumbnail_url" in (body || {});
  const resolvedThumbnailUrl = thumbnailUrl !== undefined
    ? thumbnailUrl
    : hasThumbnailField ? null : undefined;

  // ── Upcoming: edit product record ─────────────────────────────────────────
  if (courseType === "upcoming") {
    const productId = body?.id;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!productId || !title) {
      return NextResponse.json({ error: "id and title are required." }, { status: 400 });
    }
    const { error: productUpdateError } = await authContext.supabaseAdmin
      .from("products")
      .update({
        title,
        description: description || null,
        ...(resolvedThumbnailUrl !== undefined && { thumbnail_url: resolvedThumbnailUrl }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (productUpdateError) {
      return NextResponse.json({ error: productUpdateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ── Active: edit maincourse record ────────────────────────────────────────
  const id = normalizeId(body?.id);
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (id === null) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required for active courses." }, { status: 400 });
  }

  // Build the internal title if product + month + schedule provided
  let titleUpdate: string | undefined;
  const productTitle = body?.product_title as string | undefined;
  const month = typeof body?.month === "string" ? body.month.trim() : "";
  const scheduleLabel = body?.schedule === "weekend" ? "Weekend" : "Weekday";

  if (productTitle && month) {
    titleUpdate = `${productTitle} - ${month} ${scheduleLabel}`;
  } else if (typeof body?.title === "string" && body.title.trim()) {
    titleUpdate = body.title.trim();
  }

  const updatePayload: Record<string, unknown> = {
    description,
    course_type: "active",
    ...(titleUpdate && { title: titleUpdate }),
    ...(resolvedThumbnailUrl !== undefined && { thumbnail_url: resolvedThumbnailUrl }),
    ...(body?.product_id !== undefined && { product_id: body.product_id }),
  };

  const { error: updateError } = await authContext.supabaseAdmin
    .from("maincourses")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const modules = body?.modules;
  if (Array.isArray(modules)) {
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

    if (modulesToInsert.length > 0) {
      const insertData = modulesToInsert.map((mod: any) => {
        const orderIndex = validModules.findIndex((m: any) => m === mod) + 1;
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
  const source: string = body?.source ?? searchParams.get("source") ?? "maincourse";

  if (id === null) {
    return NextResponse.json({ error: "Valid id is required." }, { status: 400 });
  }

  // ── Upcoming → delete from products ──────────────────────────────────────
  if (source === "product") {
    const { error: productDeleteError } = await authContext.supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);

    if (productDeleteError) {
      return NextResponse.json({ error: productDeleteError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ── Active → delete maincourse and all related data ───────────────────────
  await authContext.supabaseAdmin.from("batches").update({ course_id: null }).eq("course_id", id);
  await authContext.supabaseAdmin.from("coursemodules").delete().eq("maincourse_id", id);
  await authContext.supabaseAdmin.from("user_video_progress").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("course_enrollments").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("course_ratings").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("certificates").delete().eq("course_id", id);

  const { error: deleteError } = await authContext.supabaseAdmin
    .from("maincourses")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
