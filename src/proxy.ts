import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// join.theark.world opens on the membership page, members.theark.world on the portal,
// courts.theark.world on court booking.
const ROOT_BY_HOST: Record<string, string> = {
  "join.theark.world": "/ark-membership",
  "members.theark.world": "/portal",
  "courts.theark.world": "/courts",
};

export async function proxy(request: NextRequest) {
  const root = ROOT_BY_HOST[request.nextUrl.hostname];
  if (root && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(root, request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
