import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function isAdminRole(role: string | null | undefined): boolean {
  return role?.toLowerCase() === "admin";
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type CourseEnrollmentRow = {
  user_id: string;
};

async function filterAssignableMemberEmails(
  supabaseAdmin: SupabaseClient,
  emails: string[],
): Promise<string[]> {
  if (emails.length === 0) return emails;

  const { data: profileRows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role");

  if (error) throw new Error(error.message);

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

export async function GET(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const { searchParams } = new URL(request.url);
  const includeMembers = searchParams.get("includeMembers") === "true";
  const courseIdParam = searchParams.get("courseId");

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
      _source: "product",
    }));

  // Return merged: active maincourses + upcoming products
  const courses = [
    ...((maincoursesData ?? []) as any[]).map((c) => ({ ...c, _source: "maincourse" })),
    ...upcomingProducts,
  ];

  // ── Fetch mentors for active courses ──
  const { data: allMembers } = await authContext.supabaseAdmin
    .from("course_members")
    .select("maincourse_id, email");

  if (allMembers && allMembers.length > 0) {
    const memberEmails = [...new Set(allMembers.map((m: any) => m.email).filter(Boolean))];
    
    if (memberEmails.length > 0) {
      const { data: mentorProfiles } = await authContext.supabaseAdmin
        .from("profiles")
        .select("email, full_name, role")
        .in("email", memberEmails)
        .in("role", ["instructor", "admin", "mentor"]);
        
      if (mentorProfiles) {
        const mentorMap = new Map(mentorProfiles.map((p: any) => [p.email?.toLowerCase(), p.full_name || p.email]));
        const mentorsByCourse = new Map<string | number, { full_name: string }[]>();
        
        for (const m of allMembers) {
          if (!m.email || !m.maincourse_id) continue;
          const name = mentorMap.get(m.email.toLowerCase());
          if (name) {
            const courseMentors = mentorsByCourse.get(m.maincourse_id) || [];
            if (!courseMentors.find((c: any) => c.full_name === name)) {
              courseMentors.push({ full_name: name });
            }
            mentorsByCourse.set(m.maincourse_id, courseMentors);
          }
        }
        
        for (const c of courses) {
          if (c._source === "maincourse") {
            c.assigned_mentors = mentorsByCourse.get(c.id) || [];
          }
        }
      }
    }
  }

  // If includeMembers requested, also return profiles + course member assignments
  if (!includeMembers) {
    return NextResponse.json(
      { success: true, courses },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Fetch all profiles for the multi-select options
  const { data: profileRows, error: usersError } = await authContext.supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role")
    .order("created_at", { ascending: false });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // Get auth emails for profiles that lack an email in the profiles table
  const authUsersResult =
    await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authEmailById = new Map(
    (authUsersResult.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  const users = ((profileRows ?? []) as ProfileRow[]).map((row) => ({
    id: row.id,
    full_name: row.full_name ?? null,
    email: row.email ?? authEmailById.get(row.id) ?? null,
    role: row.role ?? null,
  }));

  // If a specific courseId was requested, fetch its member assignments
  let assignment: { scholarEmails: string[]; mentorEmails: string[] } | undefined;

  if (courseIdParam) {
    const courseId = normalizeId(courseIdParam);
    if (courseId !== null) {
      const { data: memberRows } = await authContext.supabaseAdmin
        .from("course_members")
        .select("email")
        .eq("maincourse_id", courseId);

      const scholarEmails: string[] = [];
      const mentorEmails: string[] = [];

      // Create a fast lookup map for emails to role
      const roleByEmail = new Map(
        users.map((u) => [u.email?.trim().toLowerCase(), u.role?.toLowerCase()]),
      );

      for (const row of (memberRows ?? []) as { email: string }[]) {
        const email = row.email?.trim().toLowerCase();
        if (!email) continue;
        
        const role = roleByEmail.get(email);
        if (role === "instructor" || role === "admin" || role === "mentor") {
          mentorEmails.push(email);
        } else {
          scholarEmails.push(email);
        }
      }

      assignment = { scholarEmails, mentorEmails };
    }
  }

  return NextResponse.json(
    { success: true, courses, users, ...(assignment && { assignment }) },
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

  // ── WORKFLOW 2: Active → product + maincourse + modules + members ─────────
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
    productId = existingProductId;
  } else if (newProductTitle) {
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

  // Step 2: Build internal maincourse title from product + month
  let internalTitle: string;
  const productTitle = body?.product_title as string | undefined;
  const month = typeof body?.month === "string" ? body.month.trim() : "";

  if (productTitle && month) {
    internalTitle = `${productTitle} - ${month}`;
  } else if (typeof body?.title === "string" && body.title.trim()) {
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

  // Step 5: Assign scholars and mentors via course_members table
  let assignedScholars = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  assignedScholars = await filterAssignableMemberEmails(
    authContext.supabaseAdmin,
    assignedScholars,
  );

  const assignedMentors = Array.isArray(body?.assigned_mentors)
    ? body.assigned_mentors
        .map((v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((email: string) => EMAIL_RE.test(email))
    : [];

  const memberRows = [
    ...assignedScholars.map((email: string) => ({
      maincourse_id: newCourse.id,
      email,
    })),
    ...assignedMentors.map((email: string) => ({
      maincourse_id: newCourse.id,
      email,
    })),
  ];

  if (memberRows.length > 0) {
    const { error: memberError } = await authContext.supabaseAdmin
      .from("course_members")
      .insert(memberRows);

    if (memberError) {
      console.error("course_members insert error:", memberError.message);
    }
  }

  // Step 6: Auto-enroll scholars into phase2.enrollments
  if (assignedScholars.length > 0) {
    const authUsersResult = await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = authUsersResult.data?.users ?? [];

    const userIdsToEnroll: string[] = [];
    for (const email of assignedScholars) {
      const authUser = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (authUser) {
        // Must resolve the phase2 user id from auth user id
        const { data: p2User } = await authContext.supabaseAdmin
          .schema("phase2")
          .from("users")
          .select("id")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();

        if (p2User) {
           userIdsToEnroll.push(p2User.id);
        } else {
           userIdsToEnroll.push(authUser.id); // fallback for existing records
        }
      }
    }

    if (userIdsToEnroll.length > 0) {
      const { data: existing } = await authContext.supabaseAdmin
        .schema("phase2")
        .from("enrollments")
        .select("user_id")
        .eq("course_id", newCourse.id)
        .in("user_id", userIdsToEnroll);

      const existingUserIds = new Set(
        ((existing ?? []) as any[]).map((e) => e.user_id),
      );

      const newEnrollments = userIdsToEnroll
        .filter((id) => !existingUserIds.has(id))
        .map((id) => ({ 
           user_id: id, 
           course_id: newCourse.id,
           status: "active",
           access_start_date: new Date().toISOString(),
           access_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        }));

      if (newEnrollments.length > 0) {
        const { error: enrollError } = await authContext.supabaseAdmin
          .schema("phase2")
          .from("enrollments")
          .insert(newEnrollments);

        if (enrollError) {
          console.error("Enrollment error:", enrollError.message);
        }
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

  // Build the internal title if product + month provided
  let titleUpdate: string | undefined;
  const productTitle = body?.product_title as string | undefined;
  const month = typeof body?.month === "string" ? body.month.trim() : "";

  if (productTitle && month) {
    titleUpdate = `${productTitle} - ${month}`;
  } else if (typeof body?.title === "string" && body.title.trim()) {
    titleUpdate = body.title.trim();
  }

  const updatePayload: Record<string, unknown> = {
    description,
    course_type: "active",
    ...(titleUpdate && { title: titleUpdate }),
    ...(resolvedThumbnailUrl !== undefined && { thumbnail_url: resolvedThumbnailUrl }),
    ...(body?.product_id !== undefined && body?.product_id !== "" && { product_id: Number(body.product_id) }),
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

  // ── Step: Assign scholars and mentors via course_members ──────────────────
  let assignedScholars = Array.isArray(body?.assigned_scholars)
    ? body.assigned_scholars
        .map((v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((email: string) => EMAIL_RE.test(email))
    : [];
  assignedScholars = await filterAssignableMemberEmails(
    authContext.supabaseAdmin,
    assignedScholars,
  );

  const assignedMentors = Array.isArray(body?.assigned_mentors)
    ? body.assigned_mentors
        .map((v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((email: string) => EMAIL_RE.test(email))
    : [];

  // Only update course_members if the fields were explicitly sent
  if (body?.assigned_scholars !== undefined || body?.assigned_mentors !== undefined) {
    // Clear existing course_members for this course
    const { error: clearMembersError } = await authContext.supabaseAdmin
      .from("course_members")
      .delete()
      .eq("maincourse_id", id);

    if (clearMembersError) {
      return NextResponse.json({ error: clearMembersError.message }, { status: 500 });
    }

    const memberRows = [
      ...assignedScholars.map((email: string) => ({
        maincourse_id: id,
        email,
      })),
      ...assignedMentors.map((email: string) => ({
        maincourse_id: id,
        email,
      })),
    ];

    if (memberRows.length > 0) {
      const { error: memberError } = await authContext.supabaseAdmin
        .from("course_members")
        .insert(memberRows);

      if (memberError) {
        console.error("course_members insert error:", memberError.message);
      }
    }

    // Re-sync phase2.enrollments for scholars
    const authUsersResult = await authContext.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = authUsersResult.data?.users ?? [];

    const userIdsToEnroll: string[] = [];
    for (const email of assignedScholars) {
      const authUser = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (authUser) {
        const { data: p2User } = await authContext.supabaseAdmin
          .schema("phase2")
          .from("users")
          .select("id")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();

        if (p2User) {
           userIdsToEnroll.push(p2User.id);
        } else {
           userIdsToEnroll.push(authUser.id);
        }
      }
    }

    if (userIdsToEnroll.length > 0) {
      const { data: existing } = await authContext.supabaseAdmin
        .schema("phase2")
        .from("enrollments")
        .select("user_id")
        .eq("course_id", id)
        .in("user_id", userIdsToEnroll);

      const existingUserIds = new Set(
        ((existing ?? []) as any[]).map((e) => e.user_id),
      );

      const newEnrollments = userIdsToEnroll
        .filter((uid) => !existingUserIds.has(uid))
        .map((uid) => ({ 
           user_id: uid, 
           course_id: id,
           status: "active",
           access_start_date: new Date().toISOString(),
           access_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        }));

      if (newEnrollments.length > 0) {
        const { error: enrollError } = await authContext.supabaseAdmin
          .schema("phase2")
          .from("enrollments")
          .insert(newEnrollments);

        if (enrollError) console.error("Enrollment error:", enrollError.message);
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

  // Fetch the product_id linked to this maincourse before deleting it
  const { data: courseRow } = await authContext.supabaseAdmin
    .from("maincourses")
    .select("product_id")
    .eq("id", id)
    .maybeSingle();

  const linkedProductId = (courseRow as any)?.product_id ?? null;

  await authContext.supabaseAdmin.from("course_members").delete().eq("maincourse_id", id);
  await authContext.supabaseAdmin.from("batches").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("coursemodules").delete().eq("maincourse_id", id);
  await authContext.supabaseAdmin.from("user_video_progress").delete().eq("course_id", id);
  await authContext.supabaseAdmin.schema("phase2").from("enrollments").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("course_ratings").delete().eq("course_id", id);
  await authContext.supabaseAdmin.from("certificates").delete().eq("course_id", id);
  await authContext.supabaseAdmin.schema("phase2").from("orders").delete().eq("course_id", id);

  const { error: deleteError } = await authContext.supabaseAdmin
    .from("maincourses")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete the linked product so it doesn't reappear as an "upcoming" course
  if (linkedProductId !== null) {
    await authContext.supabaseAdmin.from("products").delete().eq("id", linkedProductId);
  }

  return NextResponse.json({ success: true });
}
