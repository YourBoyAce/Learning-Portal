import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || profile?.role?.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const accountId =
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CLOUDFLARE_STREAM_ACCOUNT_ID;
    const apiToken =
      process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        {
          error: "Cloudflare Stream is not configured on the server.",
        },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200,
          meta: {
            courseId: body?.courseId || "",
            moduleId: body?.moduleId || "",
            title: body?.title || "",
          },
        }),
      },
    );

    const json = await response.json();
    if (!response.ok || !json?.success || !json?.result?.uploadURL) {
      console.error("[cloudflare-direct-upload] Cloudflare error:", json?.errors);
      return NextResponse.json(
        { error: "Failed to create direct upload URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      uploadURL: json.result.uploadURL,
      uid: json.result.uid,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, "Cloudflare direct upload", 500);
  }
}
