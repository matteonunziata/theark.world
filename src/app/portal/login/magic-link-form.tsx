"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef, useState } from "react";
import { sendSignInLink } from "@/app/auth/actions";
import { afterEmailSignIn } from "@/lib/after-sign-in";
import { createLinkClient } from "@/lib/supabase/link-client";

/** One sign-in for the team and members; the email says who someone is. */
export function MagicLinkForm({ next }: { next: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "sent-code">("idle");
  const [email, setEmail] = useState("");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const busy = useRef(false);

  // If Supabase sends the link to the site root instead of /auth/callback
  // (redirect URL not on its allow-list), the session arrives here in the
  // fragment. Hand it to /auth/confirm, which stores it.
  useEffect(() => {
    const hash = window.location.hash;
    if (/[#&](access_token|error_description)=/.test(hash)) {
      window.location.replace(`/auth/confirm?next=${encodeURIComponent(next)}${hash}`);
    }
  }, [next]);

  async function send() {
    if (busy.current) return;
    const value = typed.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email.");
      return;
    }
    busy.current = true;
    setState("sending");
    setError("");
    setEmail(value);
    try {
      await deliver(value);
    } finally {
      busy.current = false;
    }
  }

  async function deliver(value: string) {

    // The ARK-styled email with a link and a code, when it's set up.
    const r = await sendSignInLink(value, next).catch(() => ({
      status: "error" as const,
      error: "Couldn’t send the link. Check your connection and try again.",
    }));
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

  async function signInWithPassword(form: FormData) {
    const value = typed.trim().toLowerCase();
    const pw = String(form.get("password") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email.");
      return;
    }
    if (!pw) {
      setError("Enter your password, or email yourself a link.");
      return;
    }
    setSigningIn(true);
    setError("");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { isSingleton: false, auth: { detectSessionInUrl: false } },
    );
    const { error } = await supabase.auth.signInWithPassword({ email: value, password: pw });
    if (error) {
      setSigningIn(false);
      setPassword("");
      setError(
        error.status === 429
          ? "Too many tries. Wait a few minutes, or email yourself a link."
          : "That email and password didn’t match. First time, or forgot it? Email yourself a link.",
      );
      return;
    }
    window.location.replace(next);
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
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setVerifying(false);
      setError("That code didn’t work. Check it, or ask for a new one.");
      return;
    }
    window.location.replace(afterEmailSignIn(data.user, next));
  }

  if (state === "sending") {
    return (
      <p role="status" style={{ color: "var(--ink)" }}>
        An email is on its way to <b>{email}</b>. Sending your sign-in link…
      </p>
    );
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
    <form action={signInWithPassword}>
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
          autoComplete="username"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          required
        />
      </div>
      <div className="fld">
        <label htmlFor="m-password">Password</label>
        <input
          id="m-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className="btn primary auth-btn" disabled={signingIn}>
        {signingIn ? "Signing in…" : "Sign in"}
      </button>
      <button type="button" className="linkish-sm" style={{ margin: "12px auto 0" }} onClick={send}>
        First time, or forgot your password? Email me a link
      </button>
    </form>
  );
}
