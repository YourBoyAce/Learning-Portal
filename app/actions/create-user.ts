// "use server";

// import { revalidatePath } from "next/cache";
// import { supabaseAdmin } from "@/lib/supabase-admin";

// export async function createUser(formData: FormData) {
//   const email = String(formData.get("email") || "").trim().toLowerCase();
//   const password = String(formData.get("password") || "").trim();
//   const role = String(formData.get("role") || "user").trim().toLowerCase();

//   if (!email || !password || !role) {
//     return { success: false, error: "Please fill in all fields" };
//   }

//   try {
//     // 1. Create the user in auth.users
//     const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
//       email,
//       password,
//       email_confirm: true,
//     });

//     if (authError) {
//       console.error("Auth Error:", authError.message);
//       return logAndReturnActionError(authError);
//     }

//     // 2. Create their profile
//     if (authData.user) {
//       const { error: profileError } = await supabaseAdmin
//         .from("profiles")
//         .upsert({
//           id: authData.user.id,
//           email: email,
//           full_name: email.split("@")[0],
//           role: role,
//           created_at: new Date().toISOString(),
//         });

//       if (profileError) {
//         console.error("Profile Error:", profileError.message);
//         return { success: false, error: "User created, but profile failed: " + profileError.message };
//       }
//     }

//     revalidatePath("/admin/users");
//     return { success: true, message: "User created successfully." };
//   } catch (error: unknown) {
//     console.error("Server Action Error:", error);
//     return { success: false, error: "An unexpected server error occurred." };
//   }
// }

// export async function updateUserRole(userId: string, newRole: string) {
//   try {
//     const { error } = await supabaseAdmin
//       .from("profiles")
//       .update({ role: newRole })
//       .eq("id", userId);

//     if (error) throw new Error(error.message);

//     revalidatePath("/admin/users");
//     return { success: true };
//   } catch (error: unknown) {
//     return {
//       success: false,
//       error: logError(error).message, errorId: logError(error).id,
//     };
//   }
// }

// export async function deleteUser(userId: string) {
//   try {
//     const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
//     if (error) throw new Error(error.message);

//     revalidatePath("/admin/users");
//     return { success: true };
//   } catch (error: unknown) {
//     return {
//       success: false,
//       error: logError(error).message, errorId: logError(error).id,
//     };
//   }
// }

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { transporter } from "@/app/lib/mailer";
import { normalizePhoneNumber } from "@/app/lib/phone-verification";
import { logAndReturnActionError } from "@/app/lib/error-handler";
import { logError } from "@/app/lib/error-handler";

async function verifyAdminCaller(accessToken?: string): Promise<{ ok: true; adminUserId: string } | { ok: false; error: string }> {
  const token = accessToken?.trim();
  if (!token) {
    return { ok: false, error: "Unauthorized: Missing administrative credentials." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Authentication service is not configured." };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return { ok: false, error: "Unauthorized: Invalid or expired administrative session." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role?.toLowerCase() !== "admin") {
    return { ok: false, error: "Forbidden: Administrator permissions required." };
  }

  return { ok: true, adminUserId: user.id };
}

export async function createUser(formData: FormData, adminAccessToken?: string) {
  const token = adminAccessToken || String(formData.get("accessToken") || "").trim();
  const callerAuth = await verifyAdminCaller(token);
  if (!callerAuth.ok) {
    return { success: false, error: callerAuth.error };
  }

  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "user")
    .trim()
    .toLowerCase();
  const plan = String(formData.get("plan") || "starter")
    .trim()
    .toLowerCase();
  const courseId = String(formData.get("courseId") || formData.get("productId") || "").trim();
  const productId = courseId;
  const phoneInput = String(formData.get("phone") || "").trim();
  const normalizedPhone = phoneInput ? normalizePhoneNumber(phoneInput) : null;
  const normalizedPlan = ["starter", "pro", "premium"].includes(plan)
    ? plan
    : "starter";

  if (!username || !email || !password || !role) {
    return { success: false, error: "Please fill in all fields" };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  if (role === "admin" && !normalizedPhone) {
    return {
      success: false,
      error: "A valid phone number is required when creating an admin account.",
    };
  }

  const displayName = username;

  let assignedCourseTitle: string | null = null;

  try {
    // 1. Create the user in auth.users
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          plan: normalizedPlan,
          full_name: displayName,
          role,
        },
      });

    if (authError) {
      console.error("Auth Error:", authError.message);
      return { success: false, error: authError.message };
    }

    // 2. Create their profile
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authData.user.id,
          email: email,
          full_name: displayName,
          role: role,
          created_at: new Date().toISOString(),
          ...(role === "admin" && normalizedPhone
            ? { phone: normalizedPhone, phone_verified: true }
            : {}),
        });

      if (profileError) {
        console.error("Profile Error:", profileError);
        return {
          success: false,
          error: "User account created, but profile setup failed. Please contact support.",
        };
      }

      // 2b. Wire to phase2.users table
      let phase2UserId: string | null = null;
      try {
        const { data: existingP2User } = await supabaseAdmin
          .schema("phase2" as any)
          .from("users")
          .select("id")
          .or(`auth_user_id.eq.${authData.user.id},email.eq.${email}`)
          .maybeSingle();

        if (existingP2User?.id) {
          phase2UserId = existingP2User.id;
          await supabaseAdmin
            .schema("phase2" as any)
            .from("users")
            .update({
              auth_user_id: authData.user.id,
              username: username,
              email: email,
              role: role,
              updated_at: new Date().toISOString(),
            })
            .eq("id", phase2UserId);
        } else {
          const { data: p2UpsertData, error: phase2UserError } = await supabaseAdmin
            .schema("phase2" as any)
            .from("users")
            .insert({
              auth_user_id: authData.user.id,
              username: username,
              email: email,
              role: role,
              created_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (!phase2UserError && p2UpsertData?.id) {
            phase2UserId = p2UpsertData.id;
          }
        }
      } catch (p2Err) {
        console.error("Phase 2 User creation exception:", p2Err);
      }

      // 2c. If courseId/productId is provided, assign the course with the chosen plan
      if (courseId) {
        try {
          let { data: latestCourse } = await supabaseAdmin
            .from("maincourses")
            .select("id, title, product_id")
            .eq("id", courseId)
            .maybeSingle();

          if (!latestCourse) {
            const { data: fallbackCourse } = await supabaseAdmin
              .from("maincourses")
              .select("id, title, product_id")
              .eq("product_id", courseId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            latestCourse = fallbackCourse;
          }

          if (latestCourse?.id) {
            assignedCourseTitle = latestCourse.title;

            // Resolve bundle corresponding to the normalized plan
            let bundleQuery = supabaseAdmin
              .schema("phase2" as any)
              .from("bundles")
              .select("id, bundle_name, price");

            if (normalizedPlan === "premium") {
              bundleQuery = bundleQuery.ilike("bundle_name", "%premium%");
            } else if (normalizedPlan === "pro") {
              bundleQuery = bundleQuery
                .ilike("bundle_name", "%pro%")
                .not("bundle_name", "ilike", "%premium%");
            } else {
              bundleQuery = bundleQuery.ilike("bundle_name", "%starter%");
            }

            const { data: bundleData } = await bundleQuery.limit(1).maybeSingle();
            const targetBundleId = (bundleData as any)?.id ?? null;
            const targetPrice = (bundleData as any)?.price ?? 0;

            const enrollUserId = phase2UserId || authData.user.id;

            // Create order in phase2.orders to satisfy enrollments.order_id NOT-NULL constraint
            let orderId: number | null = null;
            try {
              const { data: newOrder, error: orderErr } = await supabaseAdmin
                .schema("phase2" as any)
                .from("orders")
                .insert({
                  user_id: enrollUserId,
                  course_id: latestCourse.id,
                  bundle_id: targetBundleId,
                  amount: targetPrice,
                  status: "paid",
                  razorpay_order_id: `admin_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  razorpay_payment_id: `admin_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select("id")
                .maybeSingle();

              if (orderErr) {
                console.error("phase2.orders insertion error:", orderErr.message);
              } else if (newOrder?.id) {
                orderId = newOrder.id;
              }
            } catch (orderEx) {
              console.error("phase2.orders exception:", orderEx);
            }

            // Insert into phase2.enrollments
            const { error: enrollError } = await supabaseAdmin
              .schema("phase2" as any)
              .from("enrollments")
              .insert({
                user_id: enrollUserId,
                order_id: orderId,
                course_id: latestCourse.id,
                bundle_id: targetBundleId,
                product_id: latestCourse.product_id || productId,
                batch_type: "recorded",
                status: "active",
                access_start_date: new Date().toISOString(),
                access_end_date: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                ).toISOString(),
              });

            if (enrollError) {
              console.error("phase2.enrollments insertion error:", enrollError.message);
            }

            // Insert into course_members
            const { error: cmError } = await supabaseAdmin
              .from("course_members")
              .insert({
                maincourse_id: latestCourse.id,
                email: email,
                status: "active",
              });

            if (cmError) {
              console.error("course_members insertion error:", cmError.message);
            }

            // Insert into course_enrollments for legacy compatibility
            try {
              await supabaseAdmin.from("course_enrollments").insert({
                user_id: authData.user.id,
                course_id: latestCourse.id,
                status: "active",
                enrolled_at: new Date().toISOString(),
              });
            } catch (ceErr) {
              console.warn("course_enrollments insertion warning:", ceErr);
            }
          }
        } catch (enrollException) {
          console.error("Course assignment exception:", enrollException);
        }
      }

      // 3. Send the Welcome Email
      try {
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_LANDING_SITE_URL || "").replace(/\/$/, "");
        const loginUrl = siteUrl ? `${siteUrl}/login` : "/login";

        await transporter.sendMail({
          from: `"The Automate Learning Portal" <${process.env.ADMIN_EMAIL}>`,
          to: email,
          subject:
            "Welcome to The Automate Learning Portal! Your Login Details",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <h2 style="color: #174778;">Welcome, ${displayName}!</h2>
              <p style="color: #374151; font-size: 16px; line-height: 1.5;">
                Your account has been successfully created. You can now log in to access your courses.
                ${
                  assignedCourseTitle
                    ? `<br/>You have been enrolled in <strong>${assignedCourseTitle}</strong> (${normalizedPlan.toUpperCase()} Plan).`
                    : ""
                }
              </p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #4b5563; font-size: 14px;"><strong>Login Email:</strong> ${email}</p>
                <p style="margin: 10px 0 0 0; color: #4b5563; font-size: 14px;"><strong>Temporary Password:</strong> ${password}</p>
              </div>

              <h3 style="color: #ef4444; font-size: 16px;">⚠️ Action Required</h3>
              <p style="color: #374151; font-size: 14px; line-height: 1.5;">
                For your security, please update this temporary password immediately after logging in. 
                <strong>Go to Profile -> Security & Authentication -> Update Password.</strong>
              </p>

              <a href="${loginUrl}" 
                 style="display: inline-block; background-color: #2283FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;">
                Log In Now
              </a>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }
    }

    revalidatePath("/admin/users");
    const successMsg = assignedCourseTitle
      ? `User created and enrolled in "${assignedCourseTitle}" (${normalizedPlan.toUpperCase()})!`
      : "User created and welcome email sent!";
    return { success: true, message: successMsg };
  } catch (error: unknown) {
    console.error("Server Action Error:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}

export async function updateUserRole(userId: string, newRole: string, adminAccessToken?: string) {
  const callerAuth = await verifyAdminCaller(adminAccessToken);
  if (!callerAuth.ok) {
    return { success: false, error: callerAuth.error };
  }

  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: logError(error).message, errorId: logError(error).id,
    };
  }
}

export async function deleteUser(userId: string, adminAccessToken?: string) {
  const callerAuth = await verifyAdminCaller(adminAccessToken);
  if (!callerAuth.ok) {
    return { success: false, error: callerAuth.error };
  }
  // userId here is the Supabase Auth UUID (= profiles.id).
  // We must wipe all three layers so that the same email is treated
  // as a brand-new user if they purchase again later.
  //
  // Deletion order (dependencies first):
  //   1. phase2 child rows (enrollments, orders) → keyed by phase2.users.id
  //   2. phase2.users                            → keyed by auth_user_id
  //   3. profiles                                → explicit (in case no auth cascade)
  //   4. auth.users                              → last
  try {
    // ── Step 1: resolve the phase2.users.id for this auth user ──────────
    const { data: phase2User } = await supabaseAdmin
      .schema("phase2" as any)
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (phase2User?.id) {
      const p2id = phase2User.id;

      // Delete enrollments
      await supabaseAdmin
        .schema("phase2" as any)
        .from("enrollments")
        .delete()
        .eq("user_id", p2id);

      // Delete orders (payments cascade from orders if FK is set)
      await supabaseAdmin
        .schema("phase2" as any)
        .from("orders")
        .delete()
        .eq("user_id", p2id);

      // Delete the phase2.users row
      const { error: phase2Error } = await supabaseAdmin
        .schema("phase2" as any)
        .from("users")
        .delete()
        .eq("id", p2id);

      if (phase2Error) {
        console.error("[deleteUser] phase2.users delete error:", phase2Error);
      }
    }

    // ── Step 2: delete from public.profiles ─────────────────────────────
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("[deleteUser] profiles delete error:", profileError);
    }

    // ── Step 3: delete the auth account ─────────────────────────────────
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(authError.message);

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("[deleteUser] Unexpected error:", error);
    return {
      success: false,
      error: logError(error).message, errorId: logError(error).id,
    };
  }
}

export async function updateUserPlan(userId: string, newPlan: string, adminAccessToken?: string) {
  const callerAuth = await verifyAdminCaller(adminAccessToken);
  if (!callerAuth.ok) {
    return { success: false, error: callerAuth.error };
  }

  const normalizedPlan = ["starter", "pro", "premium"].includes(newPlan.toLowerCase())
    ? newPlan.toLowerCase()
    : "starter";

  try {
    // 1. Update user_metadata in auth.users, preserving existing metadata
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existingMeta = authUserData?.user?.user_metadata || {};
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...existingMeta, plan: normalizedPlan },
    });

    // 2. Find phase2 user id
    const { data: p2User } = await supabaseAdmin
      .schema("phase2" as any)
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const targetUserId = p2User?.id || userId;

    // 3. Resolve target bundle
    let bundleQuery = supabaseAdmin
      .schema("phase2" as any)
      .from("bundles")
      .select("id, bundle_name, price");

    if (normalizedPlan === "premium") {
      bundleQuery = bundleQuery.ilike("bundle_name", "%premium%");
    } else if (normalizedPlan === "pro") {
      bundleQuery = bundleQuery
        .ilike("bundle_name", "%pro%")
        .not("bundle_name", "ilike", "%premium%");
    } else {
      bundleQuery = bundleQuery.ilike("bundle_name", "%starter%");
    }

    const { data: bundleData } = await bundleQuery.limit(1).maybeSingle();
    const targetBundleId = (bundleData as any)?.id ?? null;

    if (targetBundleId) {
      // 4. Update all active enrollments for this user
      const { data: existingEnrollments } = await supabaseAdmin
        .schema("phase2" as any)
        .from("enrollments")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("status", "active");

      if (existingEnrollments && existingEnrollments.length > 0) {
        await supabaseAdmin
          .schema("phase2" as any)
          .from("enrollments")
          .update({
            bundle_id: targetBundleId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", targetUserId)
          .eq("status", "active");
      } else {
        // If no active enrollment exists in phase2, check if user is in course_members
        const userEmail = authUserData?.user?.email?.trim().toLowerCase();
        if (userEmail) {
          const { data: cmRow } = await supabaseAdmin
            .from("course_members")
            .select("maincourse_id")
            .ilike("email", userEmail)
            .limit(1)
            .maybeSingle();

          if (cmRow?.maincourse_id) {
            const { data: newOrder } = await supabaseAdmin
              .schema("phase2" as any)
              .from("orders")
              .insert({
                user_id: targetUserId,
                course_id: cmRow.maincourse_id,
                bundle_id: targetBundleId,
                amount: (bundleData as any)?.price ?? 0,
                status: "paid",
                razorpay_order_id: `admin_plan_change_${Date.now()}`,
                razorpay_payment_id: `admin_plan_change_pay_${Date.now()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();

            await supabaseAdmin
              .schema("phase2" as any)
              .from("enrollments")
              .insert({
                user_id: targetUserId,
                order_id: newOrder?.id ?? null,
                course_id: cmRow.maincourse_id,
                bundle_id: targetBundleId,
                batch_type: "recorded",
                status: "active",
                access_start_date: new Date().toISOString(),
                access_end_date: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                ).toISOString(),
              });
          }
        }
      }
    }

    revalidatePath("/admin/users");
    return { success: true, message: `Plan updated to ${normalizedPlan.toUpperCase()}.` };
  } catch (error: any) {
    console.error("[updateUserPlan] error:", error);
    return { success: false, error: error.message || "Failed to update user plan." };
  }
}

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  todaySessions: { loginAt: string; logoutAt: string; durationSeconds: number }[];
  todayTimeSpentSeconds: number;
}

export async function getAdminUsers(adminAccessToken: string): Promise<{ success: boolean; users?: AdminUserData[]; error?: string }> {
  const callerAuth = await verifyAdminCaller(adminAccessToken);
  if (!callerAuth.ok) {
    return { success: false, error: callerAuth.error };
  }

  try {
    // 1. Fetch profiles
    const { data: profiles, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profError) throw profError;

    // 2. Fetch login logs for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: loginLogs } = await supabaseAdmin
      .from("user_login_logs")
      .select("user_id, logged_in_at, last_heartbeat_at, session_duration_seconds")
      .gte("logged_in_at", todayStart.toISOString())
      .order("logged_in_at", { ascending: true });

    const logsByUser = new Map<string, { sessions: { loginAt: string; logoutAt: string; durationSeconds: number }[]; totalSec: number }>();
    if (loginLogs) {
      for (const log of loginLogs) {
        if (!logsByUser.has(log.user_id)) {
          logsByUser.set(log.user_id, { sessions: [], totalSec: 0 });
        }
        const g = logsByUser.get(log.user_id)!;
        const duration = log.session_duration_seconds || 0;
        const loginMs = new Date(log.logged_in_at).getTime();
        const logoutMs =
          duration > 0
            ? loginMs + duration * 1000
            : log.last_heartbeat_at
              ? new Date(log.last_heartbeat_at).getTime()
              : loginMs;

        g.sessions.push({
          loginAt: log.logged_in_at,
          logoutAt: new Date(logoutMs).toISOString(),
          durationSeconds: duration,
        });
        g.totalSec += duration;
      }
    }

    // 3. Fetch auth users to get user_metadata.plan
    const authMetadataPlanMap = new Map<string, string>();
    try {
      const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (authUsersData?.users) {
        for (const u of authUsersData.users) {
          const plan = (
            u.user_metadata?.plan ??
            u.app_metadata?.plan ??
            u.user_metadata?.tier ??
            u.app_metadata?.tier ??
            ""
          ).toString().trim().toLowerCase();
          if (["starter", "pro", "premium"].includes(plan)) {
            authMetadataPlanMap.set(u.id, plan);
          }
        }
      }
    } catch (authListErr) {
      console.warn("Could not list auth users for metadata plan:", authListErr);
    }

    // 4. Fetch phase2 users and enrollments
    const phase2UserMap = new Map<string, string>();
    const phase2PlanMap = new Map<string, string>();
    try {
      const { data: p2Users } = await supabaseAdmin
        .schema("phase2" as any)
        .from("users")
        .select("id, auth_user_id, email, username");

      const p2IdToAuthId = new Map<string, string>();
      if (p2Users) {
        for (const u of p2Users) {
          if (u.auth_user_id && u.username) phase2UserMap.set(u.auth_user_id, u.username.trim());
          if (u.email && u.username) phase2UserMap.set(u.email.toLowerCase(), u.username.trim());
          if (u.auth_user_id && u.id) p2IdToAuthId.set(u.id, u.auth_user_id);
        }
      }

      const { data: p2Enrollments } = await supabaseAdmin
        .schema("phase2" as any)
        .from("enrollments")
        .select("user_id, bundles(bundle_name)")
        .eq("status", "active");

      if (p2Enrollments) {
        for (const e of p2Enrollments as any[]) {
          const bn = (Array.isArray(e.bundles) ? e.bundles[0]?.bundle_name : e.bundles?.bundle_name) || "";
          const lower = bn.toLowerCase();
          const planStr = lower.includes("premium") ? "premium" : lower.includes("pro") ? "pro" : "starter";
          const authId = p2IdToAuthId.get(e.user_id) || e.user_id;

          const curr = phase2PlanMap.get(authId);
          if (!curr || (curr === "starter" && planStr !== "starter") || (curr === "pro" && planStr === "premium")) {
            phase2PlanMap.set(authId, planStr);
          }
        }
      }
    } catch (p2Err) {
      console.warn("Could not fetch phase2.users/enrollments in getAdminUsers:", p2Err);
    }

    // 5. Transform profiles
    const transformed: AdminUserData[] = (profiles || []).map((profile) => {
      const userLogs = logsByUser.get(profile.id);
      const p2Name = phase2UserMap.get(profile.id) || phase2UserMap.get(profile.email?.toLowerCase() || "");
      const isFromLanding = !profile.created_at && Boolean(p2Name);
      const resolvedName = (isFromLanding && p2Name)
        ? p2Name
        : (profile.created_at && profile.full_name)
          ? profile.full_name
          : (p2Name || profile.full_name || profile.email?.split("@")[0] || "Unknown");

      const enrollmentPlan = phase2PlanMap.get(profile.id);
      const metadataPlan = authMetadataPlanMap.get(profile.id);

      // Resolve plan prioritizing the highest/active tier between enrollment and metadata
      let resolvedPlan = "starter";
      if (enrollmentPlan === "premium" || metadataPlan === "premium") {
        resolvedPlan = "premium";
      } else if (enrollmentPlan === "pro" || metadataPlan === "pro") {
        resolvedPlan = "pro";
      } else if (enrollmentPlan === "starter" || metadataPlan === "starter") {
        resolvedPlan = "starter";
      }

      return {
        id: profile.id,
        name: resolvedName,
        email: profile.email || "No Email",
        role: profile.role?.toLowerCase() || "user",
        plan: resolvedPlan,
        todaySessions: userLogs?.sessions || [],
        todayTimeSpentSeconds: userLogs?.totalSec || 0,
      };
    });

    return { success: true, users: transformed };
  } catch (err: any) {
    console.error("getAdminUsers error:", err);
    return { success: false, error: err.message || "Failed to load users" };
  }
}
