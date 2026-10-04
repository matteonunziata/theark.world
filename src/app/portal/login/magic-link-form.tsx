"use client";

import { useState } from "react";
import { createLinkClient } from "@/lib/supabase/link-client";

export function MagicLinkForm({
  next,
  domain,
}: {
  next: string;
  /** Only accept emails at this domain (team sign-in). */
  domain?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send(form: FormData) {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (domain && !email.endsWith(`@${domain}`)) {
      setError(`Use your @${domain} email.`);
      return;
    }
    setState("sending");
    setError("");
    const { error } = await createLinkClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setState("idle");
      // The sign-in hook explains why an email can't be used.
      setError(
        error.status === 429
          ? "The sign-in email limit for this hour has been reached. Try again in an hour."
          : error.message || "Couldn’t send the link. Try again.",
      );
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p role="status" style={{ color: "var(--ink)" }}>
        Check your inbox for a sign-in link. You can open it on any device.
      </p>
    );
  }
  return (
    <form action={send}>
      {error && (
        <p className="auth-err" role="alert">
          {error}
        </p>
      )}
      <div className="fld">
        <label htmlFor="m-email">Email</label>
        <input
          id="m-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={domain ? `you@${domain}` : undefined}
          required
        />
      </div>
      <button type="submit" className="btn primary auth-btn" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
