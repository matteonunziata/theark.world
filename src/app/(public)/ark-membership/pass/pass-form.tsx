"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { buyPass } from "./actions";

export function PassForm({
  plans,
  initial,
}: {
  plans: { key: string; name: string; price: string; note: string }[];
  initial: string;
}) {
  const [state, action, pending] = useActionState(buyPass, { ok: false } as ActionResult);
  const [plan, setPlan] = useState(initial);
  const chosen = plans.find((p) => p.key === plan) ?? plans[0];
  return (
    <form className="ms-apply-card" action={action}>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="ms-hp" />
      <fieldset>
        <legend>Your pass</legend>
        <div className="ms-tiers">
          {plans.map((p) => (
            <label key={p.key} className={plan === p.key ? "on" : ""}>
              <input type="radio" name="plan" value={p.key} checked={plan === p.key} onChange={() => setPlan(p.key)} />
              <span>
                <b>{p.name}</b>
                <em>
                  {p.price}, {p.note}
                </em>
              </span>
            </label>
          ))}
        </div>
        <div className="ms-grid2">
          <div className="ms-f">
            <label htmlFor="p-name">Your name</label>
            <input id="p-name" name="name" autoComplete="name" required />
          </div>
          <div className="ms-f">
            <label htmlFor="p-email">Email</label>
            <input id="p-email" name="email" type="email" autoComplete="email" required />
          </div>
        </div>
      </fieldset>
      {!state.ok && state.error && (
        <div className="ms-error" role="alert">
          {state.error}
        </div>
      )}
      <div className="ms-nav-row">
        <span />
        <button type="submit" className="ms-btn solid" disabled={pending}>
          {pending ? "Opening payment…" : `Pay ${chosen.price}`}
        </button>
      </div>
      <p className="ms-fine ms-center">
        You’ll pay on Stripe, then get your pass by email. No date to pick: it starts the first time security checks
        you in, any day in the next three months.
      </p>
    </form>
  );
}
