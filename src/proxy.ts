import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// join.theark.world opens on the membership page, members.theark.world on the portal,
// courts.theark.world on court booking.
const ROOT_BY_HOST: Record<string, string> = {
  "join.theark.world": "/ark-membership",
  "members.theark.world": "/portal",
  "courts.theark.world": "/courts",
};

// On join.theark.world the public events page answers at /events. The staff
// events area (/events/...) is unchanged; staff reach its overview at /events/all.
const EVENTS_HOST = "join.theark.world";

export async function proxy(request: NextRequest) {
  const root = ROOT_BY_HOST[request.nextUrl.hostname];
  if (root && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(root, request.url));
  }
  if ((request.headers.get("host") ?? "").split(":")[0] === EVENTS_HOST && request.nextUrl.pathname === "/events") {
    return updateSession(request, "/whats-on");
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
