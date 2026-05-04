import { NextResponse } from "next/server";

export async function GET() {
  // Use your real ID and Token directly here just to TEST if the connection works
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/videos`;

    // Setting a timeout and forcing no-cache
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    console.log(`Response status: `, response);

    if (!response.ok) {
      const text = await response.text();
      console.error(`API Error Status: ${response.status}`);
      console.error(`API Error Response: ${text}`);

      let details;
      try {
        details = JSON.parse(text);
      } catch {
        details = text;
      }

      return NextResponse.json(
        {
          success: false,
          error: `API returned ${response.status}`,
          details,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, message: "CONNECTED! 🚀", data });
  } catch (err: unknown) {
    // This will tell us the exact SYSTEM reason it is failing
    console.error(err);
    const maybeErr = err as { cause?: { code?: string }; code?: string; message?: string };
    return NextResponse.json({
      error: "Hard Connection Failure",
      code: maybeErr.cause?.code || maybeErr.code,
      message: maybeErr.message || "Unknown error",
    });
  }
}
