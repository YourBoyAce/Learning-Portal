import { supabase } from "./supabase";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Cookie: cookieStore.toString(),
        },
      },
    }
  );
}