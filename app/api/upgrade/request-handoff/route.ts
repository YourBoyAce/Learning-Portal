/**
 * POST /api/upgrade/request-handoff
 *
 * Called by the portal's UpgradeRequired component (and the /upgrade page)
 * to initiate a portal-to-landing-site Pro upgrade.
 *
 * What it does
 *   1. Authenticates the calling portal user via their Supabase Bearer token.
 *   2. Calls POST <landing-site>/api/upgrade/init-handoff forwarding the token.
 *   3. Receives a short-lived HMAC-signed handoff token from the landing site.
 *   4. Returns a redirect URL the client should navigate to:
 *        <landing-site>/payment?upgradeMode=1&token=<token>
 *
 * Why the portal does this server-side
 *   The portal must forward its own Supabase access token to init-handoff so
 *   the landing site can verify the user's identity without trusting URL
 *   parameters.  The access token must never appear in a browser-visible URL
 *   or client-side code that could be read by a third party.
 *
 * Request
 *   Authorization: Bearer <supabase-access-token>
 *   Body: {} (empty — identity comes from the token)
 *
 * Response (success)
 *   { redirectUrl: string }
 *
 * Response (failure)
 *   { error: string }
 *
 * Falls back gracefully when NEXT_PUBLIC_LANDING_SITE_URL is not configured —
 * the caller should fall back to the portal's own /upgrade page in that case.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const LANDING_SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_SITE_URL?.replace(/\/$/, "") ?? "";

export async function POST(request: Request) {
  // ── Guard: landing site not configured ────────────────────────────────────
  if (!LANDING_SITE_URL) {
    return NextResponse.json(
      { error: "Landing site URL is not configured." },
      { status: 503 },
    );
  }

  // ── Authenticate the portal user ──────────────────────────────────────────
  const authHeader  = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify the token is valid for the shared Supabase project
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await authClient.auth.getUser(accessToken);
  if (!authData.user) {
    return NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 },
    );
  }

  let bodyData = {};
  try {
    bodyData = await request.json();
  } catch (e) {}

  // ── Call landing site init-handoff ────────────────────────────────────────
  // NOTE: In development this requires the landing site dev server to be
  // running on the same machine (default: http://localhost:3000).
  // Start it with:  cd d:\automate-phase2-landing\web && npm run dev
  let handoffToken: string;
  try {
    const res = await fetch(`${LANDING_SITE_URL}/api/upgrade/init-handoff`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        // Forward the portal user's access token so init-handoff can verify
        // their identity on the landing site's Supabase client.
        Authorization:   `Bearer ${accessToken}`,
      },
      body: JSON.stringify(bodyData),
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      console.error(
        "[request-handoff] init-handoff returned error:",
        res.status,
        data,
      );
      return NextResponse.json(
        { error: data.error ?? "Failed to initiate upgrade session. Please try again." },
        { status: res.ok ? 500 : res.status },
      );
    }

    handoffToken = data.token;
  } catch (err: any) {
    // Most likely cause: landing site is not running / not reachable at LANDING_SITE_URL.
    // In development: start the landing site with `npm run dev` (port 3000).
    // In production: verify NEXT_PUBLIC_LANDING_SITE_URL points to the deployed landing site.
    console.error(
      `[request-handoff] Could not reach landing site at ${LANDING_SITE_URL}:`,
      err?.message,
    );
    return NextResponse.json(
      {
        error:
          "The checkout service is not reachable. " +
          (process.env.NODE_ENV === "development"
            ? "Make sure the landing site dev server is running on port 3000."
            : "Please try again or contact support."),
      },
      { status: 502 },
    );
  }

  // ── Build redirect URL ────────────────────────────────────────────────────
  // The token is safe in a URL query parameter — it is HMAC-signed and
  // short-lived (300 s).  No secrets, user IDs, or prices are in the token;
  // the payload is verified server-side by validate-handoff before use.
  const redirectUrl =
    `${LANDING_SITE_URL}/payment?upgradeMode=1&token=${encodeURIComponent(handoffToken)}`;

  return NextResponse.json({ redirectUrl });
}
