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
//       return { success: false, error: authError.message };
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
//       error: error instanceof Error ? error.message : "Unknown error",
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
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }

"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { transporter } from "@/app/lib/mailer";
import { normalizePhoneNumber } from "@/app/lib/phone-verification";

export async function createUser(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "user").trim().toLowerCase();
  const phoneInput = String(formData.get("phone") || "").trim();
  const normalizedPhone = phoneInput ? normalizePhoneNumber(phoneInput) : null;

  if (!username || !email || !password || !role) {
    return { success: false, error: "Please fill in all fields" };
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
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
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
        console.error("Profile Error:", profileError.message);
        return { success: false, error: "User created, but profile failed: " + profileError.message };
      }

      // 3. Send the Welcome Email
      try {
        await transporter.sendMail({
          from: `"The Automate Learning Portal" <${process.env.ADMIN_EMAIL}>`,
          to: email,
          subject: "Welcome to The Automate Learning Portal! Your Login Details",
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

              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" 
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

export async function updateUserRole(userId: string, newRole: string) {
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
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteUser(userId: string) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
