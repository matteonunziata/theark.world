"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Any Google account. The real check is the sign-in hook in the database.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError("Google sign-in isn’t available right now. Try again soon.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn primary auth-btn"
        onClick={signIn}
        disabled={busy}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="g">
          <path
            fill="currentColor"
            d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
          />
        </svg>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {error && <p className="auth-err">{error}</p>}
    </>
  );
}
