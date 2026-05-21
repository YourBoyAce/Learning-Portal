import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId =
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CLOUDFLARE_STREAM_ACCOUNT_ID;
    const apiToken =
      process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN;

      console.log("Account ID:", accountId);
console.log("Token exists:", !!apiToken);
console.log("Token length:", apiToken?.length);

    if (!accountId || !apiToken) {
      return NextResponse.json(
        {
          error:
            "Cloudflare Stream is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN (or CLOUDFLARE_API_TOKEN).",
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
    console.log("Cloudflare response:", json);
    if (!response.ok || !json?.success || !json?.result?.uploadURL) {
      return NextResponse.json(
        { error: json?.errors?.[0]?.message || "Failed to create direct upload URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      uploadURL: json.result.uploadURL,
      uid: json.result.uid,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize Cloudflare upload.",
      },
      { status: 500 },
    );
  }
}
