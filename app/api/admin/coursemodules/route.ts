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
  const cloudflareUidsRaw =
    typeof formData.get("cloudflareUids") === "string"
      ? String(formData.get("cloudflareUids")).trim()
      : "";
  const cloudflareUids = cloudflareUidsRaw
    ? (() => {
        try {
          const parsed = JSON.parse(cloudflareUidsRaw);
          return Array.isArray(parsed)
            ? parsed.filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0,
              )
            : [];
        } catch {
          return [];
        }
      })()
    : [];

  let uid = cloudflareUid || cloudflareUids[0] || "";
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
  const thumbnailUrl =
    typeof formData.get("thumbnail_url") === "string"
      ? String(formData.get("thumbnail_url")).trim()
      : "";

  // Create or update module WITHOUT waiting for duration (background process)
  const { data: moduleResult, error: dbError } = moduleId
    ? await authContext.supabaseAdmin
        .from("coursemodules")
        .update({
          video_cf_id: uid,
          ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
        })
        .eq("id", moduleId)
        .select("*")
        .single()
    : await authContext.supabaseAdmin
        .from("coursemodules")
        .insert({
          maincourse_id: maincourseId,
          title,
          video_cf_id: uid,
          ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
        })
        .select("*")
        .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Fetch duration in the background (non-blocking)
  // This runs without waiting for completion
  (async () => {
    try {
      const fetchDurationWithRetry = async (maxRetries = 5) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const metadataUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/stream/${uid}`;
            const metadataResponse = await fetch(metadataUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${cloudflareApiToken}`,
              },
            });

            if (!metadataResponse.ok) {
              console.warn(`Attempt ${attempt + 1}: Failed to fetch metadata - ${metadataResponse.statusText}`);
              if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              }
              continue;
            }

            const metadataResult = await metadataResponse.json();
            console.log(`Attempt ${attempt + 1} - Cloudflare metadata response:`, metadataResult);
            
            const durationSeconds = metadataResult?.result?.duration;
            const status = metadataResult?.result?.status?.state;
            
            if (durationSeconds && durationSeconds > 0) {
              const totalSeconds = Math.round(durationSeconds);
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              
              const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
              console.log(`✓ Duration extracted: ${durationSeconds}s → ${formatted}`);
              return formatted;
            } else if (status === "queued" || status === "processing") {
              console.log(`Attempt ${attempt + 1}: Video still processing (status: ${status}), retrying...`);
              if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              }
            } else {
              console.warn(`No valid duration found (duration: ${durationSeconds}, status: ${status})`);
              return null;
            }
          } catch (error) {
            console.warn(`Attempt ${attempt + 1}: Error fetching duration -`, error);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
          }
        }
        return null;
      };
      
      const videoDuration = await fetchDurationWithRetry();
      
      if (videoDuration && moduleResult?.id) {
        // Update module with duration once available
        await authContext.supabaseAdmin
          .from("coursemodules")
          .update({ duration: videoDuration })
          .eq("id", moduleResult.id);
        console.log(`✓ Module ${moduleResult.id} updated with duration: ${videoDuration}`);
      }
    } catch (error) {
      console.error("Background duration fetch failed:", error);
    }
  })();

  return NextResponse.json({
    success: true,
    module: moduleResult,
    videoUrl,
    cloudflareUid: uid,
    message: "Video uploaded successfully. Duration will be added automatically.",
  });
}
