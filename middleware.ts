import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // For now, let client-side handle auth
  // Middleware can't access localStorage-based Supabase auth
  // This is a placeholder - real auth check happens in page components

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/courses/:path*", "/admin/:path*"],
};
