import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Mux webhook handler not implemented yet." },
    { status: 501 },
  );
}
