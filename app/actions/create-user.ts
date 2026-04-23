"use server";

import { createServiceRoleClient } from "@/app/lib/supabase-server";

export async function createUser(formData: FormData) {
  const supabase = createServiceRoleClient();
  
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  if (!email || !password || !role) {
    return { error: "Please fill in all fields" };
  }

  try {
    // Create user in Supabase Auth using service role
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return { error: authError.message };
    }

    // Create profile in profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        email: email,
        role: role === "Lead Curator" ? "admin" : "student",
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      return { error: profileError.message };
    }

    return { success: true, userId: authData.user.id };
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create user";
    return { error: errorMessage };
  }
}
