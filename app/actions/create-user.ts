"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWelcomeEmail } from "@/lib/send-email";

function generateTemporaryPassword() {
  const value = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return `Auto@${String(value).padStart(6, "0")}`;
}

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "user").trim().toLowerCase();

  if (!email || !role) {
    return { success: false, error: "Please fill in all fields" };
  }

  const temporaryPassword = generateTemporaryPassword();

  try {
    // 1. Create the user in auth.users with temporary password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth Error:", authError.message);
      return { success: false, error: authError.message };
    }

    // 2. Safely create or update their profile with password_updated = false
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authData.user.id,
          email: email,
          full_name: email.split("@")[0],
          role: role,
          password_updated: false,
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error("Profile Error:", profileError.message);
        return { success: false, error: "User created, but profile failed: " + profileError.message };
      }

      // 3. Send welcome email with temporary credentials
      try {
        await sendWelcomeEmail(email, temporaryPassword);
      } catch (emailError) {
        console.error("Welcome email error:", emailError);
        revalidatePath("/admin/users");
        return {
          success: true,
          warning: true,
          message: "User created but email could not be sent. Please check Resend configuration/logs.",
        };
      }
    }

    revalidatePath("/admin/users");
    return { success: true, message: "User created. Welcome email sent with temporary credentials." };
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
