"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm({ next, canSkip }: { next: string; canSkip: boolean }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(form: FormData) {
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords don’t match.");
      return;
    }
    setSaving(true);
    setError("");
    const { error } = await createClient().auth.updateUser({
      password,
      data: { has_password: true },
    });
    if (error) {
      setSaving(false);
      setError(error.message || "Couldn’t save that password. Try again.");
      return;
    }
    window.location.replace(next);
  }

  return (
    <form action={save}>
      {error && (
        <p className="auth-err" role="alert">
          {error}
        </p>
      )}
      <div className="fld">
        <label htmlFor="p-new">Password</label>
        <input id="p-new" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="fld">
        <label htmlFor="p-confirm">Confirm password</label>
        <input id="p-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button type="submit" className="btn primary auth-btn" disabled={saving}>
        {saving ? "Saving…" : "Save password"}
      </button>
      {canSkip && (
        <a className="linkish-sm" style={{ display: "block", textAlign: "center", margin: "12px auto 0" }} href={next}>
          Skip for now
        </a>
      )}
    </form>
  );
}
