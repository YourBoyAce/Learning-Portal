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
      try {
        const { error: phase2UserError } = await supabaseAdmin
          .schema("phase2" as any)
          .from("users")
          .upsert(
            {
              auth_user_id: authData.user.id,
              username: username,
              email: email,
              role: role,
              created_at: new Date().toISOString(),
            },
            { onConflict: "auth_user_id" }
          );

        if (phase2UserError) {
          console.error("Phase 2 User sync error:", phase2UserError.message);
        }
      } catch (p2Err) {
        console.error("Phase 2 User creation exception:", p2Err);
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
    return { success: true, message: "User created and welcome email sent!" };
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
