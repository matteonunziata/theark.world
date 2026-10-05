import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google and magic-link sign-ins land here with a one-time code.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const back = next.startsWith("/classes")
    ? "/facilitator"
    : next.startsWith("/portal") || next.startsWith("/e/")
      ? "/portal/login"
      : "/login";
  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`${back}?error=${encodeURIComponent(message)}`, url.origin),
    );

  // Rejections from the sign-in hook come back as error_description.
  const error = url.searchParams.get("error_description");
  if (error) return fail(error);

  // Email links carry the session in the URL fragment, which never reaches
  // the server. The browser keeps the fragment across this redirect, and
  // /auth/confirm stores the session.
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth/confirm?next=${encodeURIComponent(next)}`, url.origin),
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return fail(
      "That sign-in link has expired or was opened in a different browser. Try again.",
    );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
