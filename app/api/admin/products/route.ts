import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AuthContext =
  | { error: NextResponse }
  | { token: string; userId: string; supabaseAdmin: SupabaseClient };

async function authenticateAdmin(request: Request): Promise<AuthContext> {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 }) };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: profile, error: profileError } = await supabaseUser
    .from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profileError || profile?.role?.toLowerCase() !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseClient;

  return { token, userId: authData.user.id, supabaseAdmin };
}

// GET /api/admin/products — list all products
export async function GET(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) return authContext.error;

  const { data, error } = await authContext.supabaseAdmin
    .from("products")
    .select("id, title, description, thumbnail_url, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, products: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/products — create a product
export async function POST(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) return authContext.error;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const thumbnailUrl = typeof body?.thumbnail_url === "string" ? body.thumbnail_url.trim() : null;

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const { data: product, error } = await authContext.supabaseAdmin
    .from("products")
    .insert({ title, description: description || null, thumbnail_url: thumbnailUrl || null })
    .select("id, title, description, thumbnail_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, product });
}

// PUT /api/admin/products — update a product
export async function PUT(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) return authContext.error;

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  const hasThumbnail = "thumbnail_url" in (body || {});
  const thumbnailUrl = typeof body?.thumbnail_url === "string"
    ? body.thumbnail_url.trim()
    : hasThumbnail ? null : undefined;

  if (!id || !title) return NextResponse.json({ error: "id and title are required." }, { status: 400 });

  const { error } = await authContext.supabaseAdmin
    .from("products")
    .update({
      title,
      description: description || null,
      ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/products — delete a product (only if no maincourses reference it)
export async function DELETE(request: Request) {
  const authContext = await authenticateAdmin(request);
  if ("error" in authContext) return authContext.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Valid product id is required." }, { status: 400 });

  const { error } = await authContext.supabaseAdmin
    .from("products")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
