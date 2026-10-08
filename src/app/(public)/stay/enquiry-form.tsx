"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { stayEnquiry } from "./actions";

export function EnquiryForm() {
  const [state, action, pending] = useActionState(stayEnquiry, { ok: false } as ActionResult);
  return (
    <form className="host-form" action={action}>
      <label>
        Name
        <input type="text" name="name" autoComplete="name" required />
      </label>
      <label>
        Email
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label>
        What for
        <select name="topic" defaultValue="Meals">
          <option>Meals</option>
          <option>Experiences</option>
          <option>Flights and shuttles</option>
          <option>Staying a season</option>
          <option>Something else</option>
        </select>
      </label>
      <label>
        Dates
        <input type="text" name="dates" placeholder="e.g. 12 to 19 March" />
      </label>
      <label className="full">
        Tell us a little
        <textarea name="details" rows={4} />
      </label>
      <input type="text" name="hp_contact" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      {state.ok ? (
        <p className="form-thanks" role="status">
          {state.message}
        </p>
      ) : (
        <div className="form-foot">
          <span role="alert">{state.error ?? "We reply within a day or two."}</span>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </form>
  );
}
