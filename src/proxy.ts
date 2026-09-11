import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Serve character initialization as the real document at `/` (no App Router chrome). */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(
      new URL("/character-initialization.html", request.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
