"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { sendSignInLink } from "@/app/auth/actions";
import { createLinkClient } from "@/lib/supabase/link-client";

export function MagicLinkForm({
  next,
  domain,
}: {
  next: string;
  /** Only accept emails at this domain (team sign-in). */
  domain?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "sent-code">("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function send(form: FormData) {
    const value = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email.");
      return;
    }
    if (domain && !value.endsWith(`@${domain}`)) {
      setError(`Use your @${domain} email.`);
      return;
    }
    setState("sending");
    setError("");
    setEmail(value);

    // The ARK-styled email with a link and a code, when it's set up.
    const r = await sendSignInLink(value, next, !!domain).catch(() => ({ status: "fallback" as const }));
    if (r.status === "sent") {
      setState("sent-code");
      return;
    }
    if (r.status === "error") {
      setState("idle");
      setError(r.error);
      return;
    }

    // Otherwise Supabase sends its own email.
    const { error } = await createLinkClient().auth.signInWithOtp({
      email: value,
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

  async function verify(form: FormData) {
    const token = String(form.get("code") ?? "").replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the code from the email.");
      return;
    }
    setVerifying(true);
    setError("");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { isSingleton: false, auth: { detectSessionInUrl: false } },
    );
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setVerifying(false);
      setError("That code didn’t work. Check it, or ask for a new one.");
      return;
    }
    window.location.replace(next);
  }

  if (state === "sent") {
    return (
      <p role="status" style={{ color: "var(--ink)" }}>
        Check your inbox for a sign-in link. You can open it on any device.
      </p>
    );
  }
  if (state === "sent-code") {
    return (
      <form action={verify}>
        <p role="status" style={{ color: "var(--ink)", marginTop: 0 }}>
          We emailed a sign-in link to <b>{email}</b>. Tap it on any device, or enter the code from the email here.
        </p>
        {error && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
        <div className="fld">
          <label htmlFor="m-code">Code</label>
          <input
            id="m-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            style={{ letterSpacing: ".3em", fontSize: 20, textAlign: "center" }}
            required
          />
        </div>
        <button type="submit" className="btn primary auth-btn" disabled={verifying}>
          {verifying ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          className="linkish-sm"
          style={{ margin: "12px auto 0" }}
          onClick={() => {
            setState("idle");
            setError("");
          }}
        >
          Use a different email
        </button>
      </form>
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
