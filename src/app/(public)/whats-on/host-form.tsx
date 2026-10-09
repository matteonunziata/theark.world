"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { hostEnquiry } from "./actions";

export function HostForm() {
  const [state, action, pending] = useActionState(hostEnquiry, { ok: false } as ActionResult);
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
        Type of event
        <select name="type">
          <option>Retreat</option>
          <option>Workshop</option>
          <option>Dinner</option>
          <option>Celebration</option>
          <option>Something else</option>
        </select>
      </label>
      <label>
        Guests
        <input type="number" name="guests" min={1} />
      </label>
      <label>
        Preferred dates
        <input type="text" name="dates" placeholder="e.g. mid-March, 3 nights" />
      </label>
      <label>
        Spaces you’d like
        <select name="spaces">
          <option>Not sure yet</option>
          <option>ARK House</option>
          <option>Shala</option>
          <option>Space Deck</option>
          <option>Courts</option>
          <option>Several</option>
        </select>
      </label>
      <label>
        Phone (WhatsApp preferred)
        <input type="tel" name="phone" autoComplete="tel" />
      </label>
      <label>
        Instagram or Facebook
        <input type="text" name="social" placeholder="@yourname or a link" />
      </label>
      <label>
        Duration
        <input type="text" name="duration" placeholder="e.g. 3 hours, 2 days" />
      </label>
      <label>
        Ticketed or free
        <select name="ticketing" defaultValue="">
          <option value="">Not sure yet</option>
          <option>Ticketed</option>
          <option>Free</option>
        </select>
      </label>
      <label className="full">
        Short description
        <input type="text" name="short" maxLength={160} placeholder="One line about the event" />
      </label>
      <label className="full">
        Long description
        <textarea name="details" rows={4} />
      </label>
      <label className="full">
        Additional information
        <textarea name="extra" rows={3} placeholder="Anything else we should know" />
      </label>
      <input type="text" name="ms_trap_x" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      {state.ok ? (
        <p className="form-thanks" role="status">
          {state.message}
        </p>
      ) : (
        <div className="form-foot">
          <span role="alert">{state.error ?? "We reply within a few days."}</span>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send enquiry"}
          </button>
        </div>
      )}
    </form>
  );
}
