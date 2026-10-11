import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse, logError } from "@/app/lib/error-handler";

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
    return apiErrorResponse(maincoursesError, undefined, 500);
  }

  // Fetch products (represent "upcoming" planned offerings)
  const { data: productsData, error: productsError } = await authContext.supabaseAdmin
    .from("products")
    .select("id, title, description, thumbnail_url, created_at")
    .order("created_at", { ascending: false });

  if (productsError) {
    return apiErrorResponse(productsError, undefined, 500);
  }

  // Products that already have a linked maincourse are "active" â€” don't show them in upcoming.
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

  // â”€â”€ Fetch mentors for active courses â”€â”€
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
    return apiErrorResponse(usersError, undefined, 500);
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
//     return apiErrorResponse(insertError, undefined, 500);
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
//     return apiErrorResponse(updateError, undefined, 500);
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
//         { error: logError(fetchError).message },
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
//           { error: logError(deleteModulesError).message },
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
//           { error: logError(modUpdateError).message },
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
//           { error: logError(insertModulesError).message },
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

  // â”€â”€ WORKFLOW 1: Upcoming â†’ insert into products only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (courseType === "upcoming") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const { error: productError } = await authContext.supabaseAdmin
      .from("products")
      .insert({ title, description: description || null, thumbnail_url: thumbnailUrl || null });

    if (productError) return apiErrorResponse(productError, undefined, 500);
    return NextResponse.json({ success: true });
  }

  // â”€â”€ WORKFLOW 2: Active â†’ product + maincourse + modules + members â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      return apiErrorResponse(productInsertError, undefined, 500);
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
      whatsapp_community_link: body?.whatsapp_community_link || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return apiErrorResponse(insertError, undefined, 500);
  }

  // Step 4: Insert sections and modules
  const sections = Array.isArray(body?.sections) ? body.sections : [];
  if (sections.length > 0) {
    // New format: sections with nested modules
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const sectionTitle = typeof sec.title === "string" ? sec.title.trim() : "";
      if (!sectionTitle) continue;

      const { data: newSection, error: sectionError } = await authContext.supabaseAdmin
        .from("course_sections")
        .insert({
          maincourse_id: newCourse.id,
          title: sectionTitle,
          description: typeof sec.description === "string" ? sec.description.trim() : "",
          order_index: sIdx + 1,
        })
        .select("id")
        .single();

      if (sectionError) {
        return NextResponse.json(
          { error: logError(sectionError).message },
          { status: 500 },
        );
      }

      const sectionModules = Array.isArray(sec.modules) ? sec.modules : [];
      if (sectionModules.length > 0 && newSection) {
        const modulesToInsert = sectionModules
          .map((m: any, mIdx: number) => ({
            maincourse_id: newCourse.id,
            section_id: newSection.id,
            title: typeof m.title === "string" ? m.title.trim() : "",
            description: typeof m.description === "string" ? m.description.trim() : "",
            module_type: ["quiz", "artifact"].includes(m.module_type) ? m.module_type : "video",
            questions: Array.isArray(m.questions) ? m.questions : [],
            order_index: mIdx + 1,
          }))
          .filter((m: any) => m.title !== "");

        if (modulesToInsert.length > 0) {
          const { error: modulesError } = await authContext.supabaseAdmin
            .from("coursemodules")
            .insert(modulesToInsert);

          if (modulesError) {
            return NextResponse.json(
              { error: logError(modulesError).message },
              { status: 500 },
            );
          }
        }
      }
    }
  }

  // Legacy/fallback: flat modules array (without sections)
  const modules = Array.isArray(body?.modules) ? body.modules : [];
  if (modules.length > 0 && sections.length === 0) {
    const modulesToInsert = modules
      .map((m: any, index: number) => ({
        maincourse_id: newCourse.id,
        title: typeof m.title === "string" ? m.title.trim() : "",
        description: typeof m.description === "string" ? m.description.trim() : "",
        module_type: ["quiz", "artifact"].includes(m.module_type) ? m.module_type : "video",
        questions: Array.isArray(m.questions) ? m.questions : [],
        order_index: index + 1,
      }))
      .filter((m: any) => m.title !== "");

    if (modulesToInsert.length > 0) {
      const { error: modulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .insert(modulesToInsert);

      if (modulesError) {
        return NextResponse.json(
          { error: logError(modulesError).message },
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

    // Resolve the Starter bundle id so newly enrolled users get the correct tier.
    // The tier system reads bundle_name from this FK â€” a null bundle_id always
    // resolves to "Starter" via the fallback string, but the JOIN fails and the
    // feature gates stay locked.  We populate it explicitly here.
    const { data: starterBundle } = await authContext.supabaseAdmin
      .schema("phase2")
      .from("bundles")
      .select("id")
      .ilike("bundle_name", "%starter%")
      .limit(1)
      .maybeSingle();
    const starterBundleId: string | null = (starterBundle as any)?.id ?? null;

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
           bundle_id: starterBundleId,
           status: "active",
           access_start_date: new Date().toISOString(),
           access_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
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

  // â”€â”€ Upcoming: edit product record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      return apiErrorResponse(productUpdateError, undefined, 500);
    }
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Active: edit maincourse record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Direct title provided (e.g. edit where product/month were not re-selected)
    titleUpdate = body.title.trim();
  }
  // If titleUpdate remains undefined, the existing title in the DB is preserved.

  const updatePayload: Record<string, unknown> = {
    description,
    course_type: "active",
    ...(titleUpdate && { title: titleUpdate }),
    ...(resolvedThumbnailUrl !== undefined && { thumbnail_url: resolvedThumbnailUrl }),
    ...(body?.product_id !== undefined && body?.product_id !== "" && { product_id: body.product_id }),
    ...(body?.whatsapp_community_link !== undefined && { whatsapp_community_link: body.whatsapp_community_link || null }),
  };

  const { error: updateError } = await authContext.supabaseAdmin
    .from("maincourses")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    return apiErrorResponse(updateError, undefined, 500);
  }

  // â”€â”€ Step: Handle sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sections = body?.sections;
  if (Array.isArray(sections)) {
    const validSections = sections.filter(
      (s: any) => s && typeof s.title === "string" && s.title.trim() !== ""
    );

    const sectionsToUpdate = validSections.filter((s: any) => s.id);
    const sectionsToInsert = validSections.filter((s: any) => !s.id);
    const keepSectionIds = sectionsToUpdate.map((s: any) => s.id);

    // Fetch current sections for this course
    const { data: currentSections, error: fetchSectionsError } = await authContext.supabaseAdmin
      .from("course_sections")
      .select("id")
      .eq("maincourse_id", id);

    if (fetchSectionsError) {
      return NextResponse.json(
        { error: logError(fetchSectionsError).message },
        { status: 500 },
      );
    }

    const currentSectionIds = currentSections?.map((s: any) => s.id) ?? [];
    const deleteSectionIds = currentSectionIds.filter((sid: string) => !keepSectionIds.includes(sid));

    // Delete removed sections (modules become ungrouped via ON DELETE SET NULL)
    if (deleteSectionIds.length > 0) {
      const { error: deleteSectionsError } = await authContext.supabaseAdmin
        .from("course_sections")
        .delete()
        .in("id", deleteSectionIds);

      if (deleteSectionsError) {
        return NextResponse.json(
          { error: logError(deleteSectionsError).message },
          { status: 500 },
        );
      }
    }

    // Collect all module IDs that should be kept across all sections
    const keepModuleIds = validSections
      .flatMap((sec: any) => (Array.isArray(sec.modules) ? sec.modules : []))
      .filter((m: any) => m && m.id)
      .map((m: any) => String(m.id));

    // Fetch existing modules for this course to identify deleted modules
    const { data: existingModules, error: fetchModulesError } = await authContext.supabaseAdmin
      .from("coursemodules")
      .select("id")
      .eq("maincourse_id", id);

    if (fetchModulesError) {
      return NextResponse.json(
        { error: logError(fetchModulesError).message },
        { status: 500 },
      );
    }

    const currentModuleIds = (existingModules || []).map((m: any) => String(m.id));
    const deleteModuleIds = currentModuleIds.filter((mid: string) => !keepModuleIds.includes(mid));

    if (deleteModuleIds.length > 0) {
      await authContext.supabaseAdmin
        .from("user_video_progress")
        .delete()
        .eq("course_id", id)
        .in("video_id", deleteModuleIds);

      const { error: deleteModulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .delete()
        .in("id", deleteModuleIds);

      if (deleteModulesError) {
        return NextResponse.json(
          { error: logError(deleteModulesError).message },
          { status: 500 },
        );
      }
    }

    // Update existing sections
    for (let sIdx = 0; sIdx < sectionsToUpdate.length; sIdx++) {
      const sec = sectionsToUpdate[sIdx];
      const sectionOrderIndex = validSections.findIndex((s: any) => s.id === sec.id) + 1;
      const { error: secUpdateError } = await authContext.supabaseAdmin
        .from("course_sections")
        .update({
          title: sec.title.trim(),
          description: (sec.description || "").trim(),
          order_index: sectionOrderIndex > 0 ? sectionOrderIndex : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sec.id)
        .eq("maincourse_id", id);

      if (secUpdateError) {
        return NextResponse.json(
          { error: logError(secUpdateError).message },
          { status: 500 },
        );
      }

      // Handle modules within this section
      if (Array.isArray(sec.modules)) {
        const sectionModules = sec.modules.filter(
          (m: any) => m && typeof m.title === "string" && m.title.trim() !== ""
        );
        const modsToUpdate = sectionModules.filter((m: any) => m.id);
        const modsToInsert = sectionModules.filter((m: any) => !m.id);

        for (let mIdx = 0; mIdx < modsToUpdate.length; mIdx++) {
          const mod = modsToUpdate[mIdx];
          const { error: secModUpdateError } = await authContext.supabaseAdmin
            .from("coursemodules")
            .update({
              title: mod.title.trim(),
              description: (mod.description || "").trim(),
              module_type: ["quiz", "artifact"].includes(mod.module_type) ? mod.module_type : "video",
              questions: Array.isArray(mod.questions) ? mod.questions : [],
              section_id: sec.id,
              order_index: sectionModules.findIndex((m: any) => m.id === mod.id) + 1,
            })
            .eq("id", mod.id)
            .eq("maincourse_id", id);

          if (secModUpdateError) {
            return NextResponse.json(
              { error: logError(secModUpdateError).message },
              { status: 500 },
            );
          }
        }

        if (modsToInsert.length > 0) {
          const insertData = modsToInsert.map((mod: any, mIdx: number) => ({
            maincourse_id: id,
            section_id: sec.id,
            title: mod.title.trim(),
            description: (mod.description || "").trim(),
            module_type: ["quiz", "artifact"].includes(mod.module_type) ? mod.module_type : "video",
            questions: Array.isArray(mod.questions) ? mod.questions : [],
            order_index: sectionModules.length - modsToInsert.length + mIdx + 1,
          }));

          const { error: secModInsertError } = await authContext.supabaseAdmin
            .from("coursemodules")
            .insert(insertData);

          if (secModInsertError) {
            return NextResponse.json(
              { error: logError(secModInsertError).message },
              { status: 500 },
            );
          }
        }
      }
    }

    // Insert new sections with their modules
    for (let sIdx = 0; sIdx < sectionsToInsert.length; sIdx++) {
      const sec = sectionsToInsert[sIdx];
      const sectionOrderIndex = validSections.findIndex((s: any) => s === sec) + 1;

      const { data: newSection, error: secInsertError } = await authContext.supabaseAdmin
        .from("course_sections")
        .insert({
          maincourse_id: id,
          title: sec.title.trim(),
          description: (sec.description || "").trim(),
          order_index: sectionOrderIndex > 0 ? sectionOrderIndex : null,
        })
        .select("id")
        .single();

      if (secInsertError) {
        return NextResponse.json(
          { error: logError(secInsertError).message },
          { status: 500 },
        );
      }

      if (Array.isArray(sec.modules) && newSection) {
        const sectionModules = sec.modules
          .filter((m: any) => m && typeof m.title === "string" && m.title.trim() !== "")
          .map((m: any, mIdx: number) => ({
            maincourse_id: id,
            section_id: newSection.id,
            title: m.title.trim(),
            description: (m.description || "").trim(),
            module_type: ["quiz", "artifact"].includes(m.module_type) ? m.module_type : "video",
            questions: Array.isArray(m.questions) ? m.questions : [],
            order_index: mIdx + 1,
          }));

        if (sectionModules.length > 0) {
          await authContext.supabaseAdmin
            .from("coursemodules")
            .insert(sectionModules);
        }
      }
    }
  }

  // â”€â”€ Step: Handle flat modules (legacy / ungrouped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    const keepIds = modulesToUpdate.map((m: any) => String(m.id));

    const { data: currentModules, error: fetchError } = await authContext.supabaseAdmin
      .from("coursemodules")
      .select("id")
      .eq("maincourse_id", id);

    if (fetchError) {
      return NextResponse.json(
        { error: logError(fetchError).message },
        { status: 500 },
      );
    }

    const currentIds = currentModules?.map((m: any) => String(m.id)) ?? [];
    const deleteIds = currentIds.filter((cid: string) => !keepIds.includes(cid));

    if (deleteIds.length > 0) {
      await authContext.supabaseAdmin
        .from("user_video_progress")
        .delete()
        .eq("course_id", id)
        .in("video_id", deleteIds);

      const { error: deleteModulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .delete()
        .in("id", deleteIds);

      if (deleteModulesError) {
        return NextResponse.json(
          { error: logError(deleteModulesError).message },
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
          module_type: ["quiz", "artifact"].includes(mod.module_type) ? mod.module_type : "video",
          questions: Array.isArray(mod.questions) ? mod.questions : [],
          order_index: moduleOrderMap.get(mod.id) ?? null,
          ...(mod.section_id !== undefined ? { section_id: mod.section_id || null } : {}),
        })
        .eq("id", mod.id)
        .eq("maincourse_id", id);

      if (modUpdateError) {
        return NextResponse.json(
          { error: logError(modUpdateError).message },
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
          module_type: ["quiz", "artifact"].includes(mod.module_type) ? mod.module_type : "video",
          questions: Array.isArray(mod.questions) ? mod.questions : [],
          order_index: orderIndex > 0 ? orderIndex : null,
          ...(mod.section_id ? { section_id: mod.section_id } : {}),
        };
      });

      const { error: insertModulesError } = await authContext.supabaseAdmin
        .from("coursemodules")
        .insert(insertData);

      if (insertModulesError) {
        return NextResponse.json(
          { error: logError(insertModulesError).message },
          { status: 500 },
        );
      }
    }
  }

  // â”€â”€ Step: Assign scholars and mentors via course_members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      return apiErrorResponse(clearMembersError, undefined, 500);
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

    // Resolve the Starter bundle id so the tier system can read bundle_name correctly.
    const { data: starterBundlePut } = await authContext.supabaseAdmin
      .schema("phase2")
      .from("bundles")
      .select("id")
      .ilike("bundle_name", "%starter%")
      .limit(1)
      .maybeSingle();
    const starterBundleIdPut: string | null = (starterBundlePut as any)?.id ?? null;

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
           bundle_id: starterBundleIdPut,
           status: "active",
           access_start_date: new Date().toISOString(),
           access_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
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

  // â”€â”€ Upcoming â†’ delete from products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (source === "product") {
    const { error: productDeleteError } = await authContext.supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);

    if (productDeleteError) {
      return apiErrorResponse(productDeleteError, undefined, 500);
    }
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Active â†’ delete maincourse and all related data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    return apiErrorResponse(deleteError, undefined, 500);
  }

  // Delete the linked product so it doesn't reappear as an "upcoming" course
  if (linkedProductId !== null) {
    await authContext.supabaseAdmin.from("products").delete().eq("id", linkedProductId);
  }

  return NextResponse.json({ success: true });
}
