import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

type AuthContext =
  | { error: NextResponse }
  | { supabaseAdmin: SupabaseClient<any, "public", any> };

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

  return { supabaseAdmin };
}

export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) {
    return authContext.error;
  }
  if (!cloudflareAccountId || !cloudflareApiToken) {
    return NextResponse.json(
      { error: "Cloudflare environment variables are not configured." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const maincourseId =
    typeof formData.get("maincourseId") === "string"
      ? String(formData.get("maincourseId")).trim()
      : "";
  const title =
    typeof formData.get("title") === "string"
      ? String(formData.get("title")).trim()
      : "";
  const cloudflareUid =
    typeof formData.get("cloudflareUid") === "string"
      ? String(formData.get("cloudflareUid")).trim()
      : "";

  let uid = cloudflareUid;
  let videoUrl = uid ? `https://watch.cloudflarestream.com/${uid}` : "";

  // If no cloudflareUid is provided, try to upload the file directly
  if (!uid) {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Video file or cloudflareUid is required." },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/stream`;
    const cloudflareResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudflareApiToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: fileBuffer,
    });

    const cloudflareResult = await cloudflareResponse.json().catch(() => null);

    if (!cloudflareResponse.ok || !cloudflareResult?.success) {
      return NextResponse.json(
        {
          error: "Failed to upload video to Cloudflare.",
          details: cloudflareResult?.errors ?? cloudflareResult,
        },
        { status: 502 },
      );
    }

    uid = cloudflareResult?.result?.uid;
    if (!uid || typeof uid !== "string") {
      return NextResponse.json(
        { error: "Cloudflare upload succeeded but no video UID was returned." },
        { status: 502 },
      );
    }
    videoUrl = `https://watch.cloudflarestream.com/${uid}`;
  }

  const moduleId =
    typeof formData.get("moduleId") === "string"
      ? String(formData.get("moduleId")).trim()
      : "";

  const { data: moduleResult, error: dbError } = moduleId
    ? await authContext.supabaseAdmin
        .from("coursemodules")
        .update({ video_cf_id: uid }) // Store UID directly for better integration
        .eq("id", moduleId)
        .select("*")
        .single()
    : await authContext.supabaseAdmin
        .from("coursemodules")
        .insert({
          maincourse_id: maincourseId,
          title,
          video_cf_id: uid,
        })
        .select("*")
        .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    module: moduleResult,
    videoUrl,
    cloudflareUid: uid,
  });
}
