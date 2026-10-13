"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { brochureRequest, contribution, pressInquiry } from "./actions";

type Action = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

function useForm(action: Action) {
  return useActionState(action, { ok: false } as ActionResult);
}

const Trap = () => (
  <input type="text" name="ms_trap_x" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
);

function Foot({ state, pending, send, hint = "We reply within a day or two." }: { state: ActionResult; pending: boolean; send: string; hint?: string }) {
  return state.ok ? (
    <p className="form-thanks" role="status">
      {state.message}
    </p>
  ) : (
    <div className="form-foot">
      <span role="alert">{state.error ?? hint}</span>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Sending…" : send}
      </button>
    </div>
  );
}

export function PressForm() {
  const [state, action, pending] = useForm(pressInquiry);
  return (
    <form className="host-form" action={action}>
      <label>
        <span>Full name <span className="req">*</span></span>
        <input type="text" name="name" autoComplete="name" placeholder="Your full name" required />
      </label>
      <label>
        Company / publication
        <input type="text" name="company" autoComplete="organization" placeholder="Your company or publication" />
      </label>
      <label>
        <span>Email <span className="req">*</span></span>
        <input type="email" name="email" autoComplete="email" placeholder="your@email.com" required />
      </label>
      <label>
        WhatsApp number
        <input type="tel" name="phone" autoComplete="tel" placeholder="+1 000 000 0000" />
      </label>
      <label className="full">
        Tell us a little about your audience
        <textarea name="audience" rows={4} placeholder="Who do you reach and what topics do you cover?" />
      </label>
      <Trap />
      <Foot state={state} pending={pending} send="Send inquiry" />
    </form>
  );
}

const HOW = ["Host a retreat/event", "Teach or Perform", "Creator Opportunities"] as const;

export function ContributeForm() {
  const [state, action, pending] = useForm(contribution);
  return (
    <form className="host-form" action={action}>
      <label>
        <span>Full name <span className="req">*</span></span>
        <input type="text" name="name" autoComplete="name" required />
      </label>
      <label>
        <span>Email address <span className="req">*</span></span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="full">
        <span>WhatsApp (phone number) <span className="req">*</span></span>
        <input type="tel" name="phone" autoComplete="tel" required />
      </label>
      <fieldset>
        <legend>
          <span>How would you like to contribute? <span className="req">*</span></span>
        </legend>
        {HOW.map((h, i) => (
          <label key={h} className="choice">
            <input type="radio" name="how" value={h} required={i === 0} />
            {h}
          </label>
        ))}
      </fieldset>
      <label className="full">
        <span>Tell us more <span className="req">*</span></span>
        <textarea name="more" rows={4} placeholder="Please share details about your proposed contribution..." required />
      </label>
      <label className="full">
        <span>What inspires you about contributing to The ARK? <span className="req">*</span></span>
        <textarea name="why" rows={4} placeholder="Tell us what draws you to our community..." required />
      </label>
      <p className="note full">Please share URLs to your relevant profiles and work.</p>
      <label>
        Instagram
        <input type="url" name="instagram" placeholder="https://instagram.com/..." />
      </label>
      <label>
        TikTok
        <input type="url" name="tiktok" placeholder="https://tiktok.com/@..." />
      </label>
      <label>
        YouTube
        <input type="url" name="youtube" placeholder="https://youtube.com/..." />
      </label>
      <label>
        Website
        <input type="url" name="website" placeholder="https://yourwebsite.com" />
      </label>
      <label className="full">
        Other links
        <input type="text" name="other" placeholder="Any other relevant links..." />
      </label>
      <Trap />
      <Foot state={state} pending={pending} send="Submit inquiry" />
    </form>
  );
}

/** First name and email, then the brochure link. */
export function BrochureForm({ href }: { href: string }) {
  const [state, action, pending] = useForm(brochureRequest);
  return (
    <form className="host-form" action={action}>
      <label>
        First name
        <input type="text" name="name" autoComplete="given-name" placeholder="First name" required />
      </label>
      <label>
        Email address
        <input type="email" name="email" autoComplete="email" placeholder="Email address" required />
      </label>
      <Trap />
      {state.ok ? (
        <div className="form-foot">
          <span role="status">{state.message}</span>
          <a className="btn btn-accent" href={href} target="_blank" rel="noreferrer">
            Download brochure
          </a>
        </div>
      ) : (
        <Foot state={state} pending={pending} send="Download brochure" hint="" />
      )}
    </form>
  );
}
