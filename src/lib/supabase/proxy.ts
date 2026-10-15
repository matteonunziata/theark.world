import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the session; with `rewriteTo`, serves that path under the requested URL.
 * With `guestRewriteTo`, only people who aren't signed in get that path; the rest go on to the page itself.
 */
export async function updateSession(request: NextRequest, rewriteTo?: string, guestRewriteTo?: string) {
  const next = () =>
    rewriteTo
      ? NextResponse.rewrite(new URL(rewriteTo, request.url), { request })
      : NextResponse.next({ request });
  let response = next();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = next();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the auth token; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && guestRewriteTo) {
    return NextResponse.rewrite(new URL(guestRewriteTo, request.url), { request });
  }

  // /arkadia is the school's staff area. Anyone who isn't signed in sees the public Arkadia page at the same address.
  if (!user && request.nextUrl.pathname === "/arkadia") {
    return NextResponse.rewrite(new URL("/about-arkadia", request.url), { request });
  }

  // Facilitators have their own sign-in page.
  if (!user && request.nextUrl.pathname.startsWith("/classes")) {
    return NextResponse.redirect(new URL("/facilitator", request.url));
  }

  return response;
}
