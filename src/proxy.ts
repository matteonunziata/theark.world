import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// theark.world is the one public address. Its bare / is the public home page for visitors; people signed in
// still go to their own area from /.
const APEX = "theark.world";

// Old GHL pages with no page of their own yet go to the closest page. Temporary (302), so
// a real page can take over the address later.
const GHL_PAGE_REDIRECTS: Record<string, string> = {
  "/ark-events": "/whats-on",
  "/ark-padel": "/courts",
  "/ark-farm": "/farm-shop",
  "/ark-pass": "/ark-membership",
  "/webinar": "/home",
  "/ark-rentals": "/home",
  "/ark-ventures": "/home",
};

// join, members and courts .theark.world and theark-world.vercel.app are retired: they send everything to
// theark.world with the same path and query. join's /events was the public events page,
// which lives at /whats-on on theark.world (there /events is the staff area).
const JOIN_HOST = "join.theark.world";
// members' bare / was the portal, courts' bare / was court booking.
const ROOT_BY_RETIRED_HOST: Record<string, string> = {
  "members.theark.world": "/portal",
  "courts.theark.world": "/courts",
};
const VERCEL_HOST = "theark-world.vercel.app";

// Calls from other services can't follow a redirect, so the old vercel.app address keeps
// answering these until the webhooks point at theark.world.
const VERCEL_HOST_KEEPS = ["/api/webhooks/", "/api/cron/"];

// While theark.world is still reaching some people's old DNS answer (the GHL site), the old
// addresses keep serving the app, as before the move. Set RETIRE_OLD_HOSTS=1 in Vercel to
// make them redirect to theark.world.
const RETIRE_OLD_HOSTS = process.env.RETIRE_OLD_HOSTS === "1";
const LEGACY_ROOT: Record<string, string> = {
  "join.theark.world": "/ark-membership",
  "members.theark.world": "/portal",
  "courts.theark.world": "/courts",
};

function moveToApex(request: NextRequest, path: string) {
  const to = new URL(path, `https://${APEX}`);
  to.search = request.nextUrl.search;
  return NextResponse.redirect(to, 301);
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? request.nextUrl.hostname).split(":")[0];
  const path = request.nextUrl.pathname;

  if (!RETIRE_OLD_HOSTS && (host in LEGACY_ROOT || host === VERCEL_HOST)) {
    if (path === "/" && LEGACY_ROOT[host]) return NextResponse.redirect(new URL(LEGACY_ROOT[host], request.url));
    if (host === JOIN_HOST && path === "/events") return updateSession(request, "/whats-on");
    return updateSession(request);
  }

  if (host === JOIN_HOST) {
    if (path === "/") return moveToApex(request, "/ark-membership");
    if (path === "/events") return moveToApex(request, "/whats-on");
    return moveToApex(request, path);
  }
  if (host === VERCEL_HOST && !VERCEL_HOST_KEEPS.some((p) => path.startsWith(p))) {
    return moveToApex(request, path);
  }

  if (host in ROOT_BY_RETIRED_HOST) {
    return moveToApex(request, path === "/" ? ROOT_BY_RETIRED_HOST[host] : path);
  }
  const ghlPage = host === APEX ? GHL_PAGE_REDIRECTS[path.replace(/\/$/, "")] : undefined;
  if (ghlPage) {
    const to = new URL(ghlPage, request.url);
    to.search = request.nextUrl.search;
    return NextResponse.redirect(to, 302);
  }
  if (host === APEX && path === "/") {
    return updateSession(request, undefined, "/home");
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
