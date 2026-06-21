import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/send-email";

export async function POST(req: Request) {
  try {
    const { email, temporaryPassword } = await req.json();

    if (!email || !temporaryPassword) {
      return NextResponse.json(
        { success: false, message: "Missing email or temporary password" },
        { status: 400 }
      );
    }

    await sendWelcomeEmail(email, temporaryPassword);

    return NextResponse.json({
      success: true,
      message: "Welcome email sent successfully",
    });
  } catch (error) {
    console.error("SEND WELCOME EMAIL ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to send welcome email" },
      { status: 500 }
    );
  }
}
