import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: {
      getItem: (key) => {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      },
      setItem: (key, value) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(key);
      },
    },
  },
});

export interface ResolvedUserNameResult {
  fullName: string;
  role: string | null;
  source: "phase2" | "profiles" | "fallback";
}

/**
 * Resolves user display name:
 * - If user is coming from landing site: gets name from phase2.users.username
 * - If user was created in Learning portal: gets name from public.profiles.full_name
 */
export async function resolveUserName(
  client = supabase,
  userId: string,
  userEmail?: string | null
): Promise<string> {
  const result = await resolveUserProfileDetails(client, userId, userEmail);
  return result.fullName;
}

export async function resolveUserProfileDetails(
  client = supabase,
  userId: string,
  userEmail?: string | null
): Promise<ResolvedUserNameResult> {
  try {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name, role, created_at")
      .eq("id", userId)
      .maybeSingle();

    let phase2User: { username?: string | null; role?: string | null } | null = null;
    try {
      const { data: p2Data } = await client
        .schema("phase2" as any)
        .from("users")
        .select("username, role")
        .eq("auth_user_id", userId)
        .maybeSingle();
      phase2User = p2Data;

      if (!phase2User && userEmail) {
        const { data: p2EmailData } = await client
          .schema("phase2" as any)
          .from("users")
          .select("username, role")
          .eq("email", userEmail)
          .maybeSingle();
        phase2User = p2EmailData;
      }
    } catch (phase2Error) {
      console.warn("Could not query phase2.users:", phase2Error);
    }

    const isCreatedInLearningPortal = Boolean(profile?.created_at);
    const phase2Name = phase2User?.username?.trim() || "";
    const profileName = profile?.full_name?.trim() || "";
    const resolvedRole = profile?.role || phase2User?.role || null;

    if (!isCreatedInLearningPortal && phase2Name) {
      return { fullName: phase2Name, role: resolvedRole, source: "phase2" };
    }

    if (isCreatedInLearningPortal && profileName) {
      return { fullName: profileName, role: resolvedRole, source: "profiles" };
    }

    if (phase2Name) {
      return { fullName: phase2Name, role: resolvedRole, source: "phase2" };
    }

    if (profileName) {
      return { fullName: profileName, role: resolvedRole, source: "profiles" };
    }

    const emailFallback = userEmail?.split("@")[0] || "User";
    return { fullName: emailFallback, role: resolvedRole, source: "fallback" };
  } catch (error) {
    console.error("Error resolving user name:", error);
    const emailFallback = userEmail?.split("@")[0] || "User";
    return { fullName: emailFallback, role: null, source: "fallback" };
  }
}