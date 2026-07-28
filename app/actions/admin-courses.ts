"use server";

import { createClient } from "@supabase/supabase-js";

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

async function getAdminClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  if (!accessToken) {
    throw new Error("Unauthorized.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    throw new Error("Invalid session.");
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: profile, error: profileError } = await supabaseUser
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    throw new Error("Forbidden.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function listAdminCourses(accessToken: string) {
  const supabaseAdmin = await getAdminClient(accessToken);
  const { data, error } = await supabaseAdmin.from("maincourses").select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAdminCourse(
  accessToken: string,
  title: string,
  description: string,
) {
  const supabaseAdmin = await getAdminClient(accessToken);
  const { error } = await supabaseAdmin.from("maincourses").insert({
    title: title.trim(),
    description: description.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function updateAdminCourse(
  accessToken: string,
  id: string | number,
  title: string,
  description: string,
) {
  const normalizedId = normalizeId(id);
  if (normalizedId === null) throw new Error("Valid course id is required.");
  const supabaseAdmin = await getAdminClient(accessToken);
  const { error } = await supabaseAdmin
    .from("maincourses")
    .update({ title: title.trim(), description: description.trim() })
    .eq("id", normalizedId);
  if (error) throw new Error(error.message);
}

export async function deleteAdminCourse(
  accessToken: string,
  id: string | number,
) {
  const normalizedId = normalizeId(id);
  if (normalizedId === null) throw new Error("Valid course id is required.");
  const supabaseAdmin = await getAdminClient(accessToken);

  const { error: detachError } = await supabaseAdmin
    .from("batches")
    .update({ course_id: null })
    .eq("course_id", normalizedId);
  if (detachError) throw new Error(detachError.message);

  const { error: deleteModulesError } = await supabaseAdmin
    .from("coursemodules")
    .delete()
    .eq("maincourse_id", normalizedId);
  if (deleteModulesError) throw new Error(deleteModulesError.message);

  const { error: deleteError } = await supabaseAdmin
    .from("maincourses")
    .delete()
    .eq("id", normalizedId);
  if (deleteError) throw new Error(deleteError.message);
}


export async function createCourseModule(
  accessToken: string,
  courseId: string | number,
  title: string,
  description: string,
) {
  const supabaseAdmin = await getAdminClient(accessToken);
  const { data, error } = await supabaseAdmin
    .from("coursemodules")
    .insert({
      maincourse_id: normalizeId(courseId),
      title: title.trim(),
      description: description.trim(),
    })
    .select("id, title, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
