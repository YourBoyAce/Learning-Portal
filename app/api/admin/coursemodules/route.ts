import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;

type AuthContext =
  | { error: NextResponse }
  | { supabaseAdmin: ReturnType<typeof createClient> };

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
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };
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

  if (profileError || profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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
  const file = formData.get("file");

  if (!maincourseId || !title || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Course, video title, and file are required." },
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

  const uid = cloudflareResult?.result?.uid;
  if (!uid || typeof uid !== "string") {
    return NextResponse.json(
      { error: "Cloudflare upload succeeded but no video UID was returned." },
      { status: 502 },
    );
  }

  const videoUrl = `https://watch.cloudflarestream.com/${uid}`;

  const { data: insertedModule, error: insertError } = await authContext.supabaseAdmin
    .from("coursemodules")
    .insert({
      maincourse_id: maincourseId,
      title,
      video_cf_id: videoUrl,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    module: insertedModule,
    videoUrl,
    cloudflareUid: uid,
  });
}
