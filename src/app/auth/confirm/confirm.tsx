"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Finishes an email sign-in. The link arrives with the session in the URL
 * fragment (#access_token=…), or with a token_hash if the email template
 * uses one. Either way the session is saved to cookies here, so the link
 * works on any device, not only the one that asked for it.
 */
export function Confirm({ next }: { next: string }) {
  const [error, setError] = useState("");
  const back = next.startsWith("/classes")
    ? "/facilitator"
    : next.startsWith("/portal") || next.startsWith("/e/")
      ? "/portal/login"
      : "/login";

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    // Its own client: the shared one would try (and fail) to read the
    // fragment as a PKCE callback before we get to it.
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { isSingleton: false, auth: { detectSessionInUrl: false } },
    );

    async function run() {
      const reason = hash.get("error_description") ?? query.get("error_description");
      if (reason) throw new Error(reason.replace(/\+/g, " "));

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      const token_hash = query.get("token_hash");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      } else if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: (query.get("type") as "magiclink" | "email" | null) ?? "email",
        });
        if (error) throw error;
      } else {
        throw new Error("That sign-in link is incomplete or was already used. Ask for a new one.");
      }
      // A full load, so the server sees the new session cookies.
      window.location.replace(next);
    }

    run().catch((e: Error) => {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setError(
        /expired|invalid|not found/i.test(e.message)
          ? "That sign-in link has expired or was already used. Ask for a new one."
          : e.message,
      );
    });
  }, [next]);

  if (!error) {
    return (
      <p role="status" style={{ textAlign: "center" }}>
        Signing you in…
      </p>
    );
  }
  return (
    <>
      <h1>Couldn’t sign you in</h1>
      <p className="auth-err" role="alert">
        {error}
      </p>
      <Link className="btn primary auth-btn" href={`${back}?next=${encodeURIComponent(next)}`}>
        Get a new link
      </Link>
    </>
  );
}
