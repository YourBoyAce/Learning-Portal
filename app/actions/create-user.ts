"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function createUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "user").trim().toLowerCase();

  if (!email || !password || !role) {
    return { success: false, error: "Please fill in all fields" };
  }

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
          full_name: email.split("@")[0],
          role: role,
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error("Profile Error:", profileError.message);
        return { success: false, error: "User created, but profile failed: " + profileError.message };
      }
    }

    revalidatePath("/admin/users");
    return { success: true, message: "User created successfully." };
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
