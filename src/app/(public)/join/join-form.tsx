"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { joinWaitlist } from "./actions";

export function JoinForm({ utm, brand }: { utm: Record<string, string>; brand: string }) {
  const [state, action, pending] = useActionState(joinWaitlist, { ok: false } as ActionResult);
  if (state.ok) {
    return (
      <section className="panel done-msg">
        <p className="big">You’re on the list</p>
        <p className="muted">We’ve sent a note to your inbox. If it isn’t there in a few minutes, check your spam folder.</p>
      </section>
    );
  }
  return (
    <form action={action} className="panel join-form">
      {!state.ok && state.error && <div className="form-error" role="alert">{state.error}</div>}
      {Object.entries(utm).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="brand" value={brand} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
      <div className="fld">
        <label htmlFor="j-name">Your name</label>
        <input id="j-name" name="name" autoComplete="name" required />
      </div>
      <div className="fld">
        <label htmlFor="j-email">Email</label>
        <input id="j-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="fld">
        <label htmlFor="j-phone">WhatsApp (optional)</label>
        <input id="j-phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="note">We’ll only email you about The ARK, and you can unsubscribe from any email.</p>
    </form>
  );
}
