"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { brochureRequest, contribution, pressInquiry, stewardshipApplication } from "./actions";

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

const JOINING = ["Just me", "With a partner", "Family with children", "Other"] as const;

/** The stewardship application. Two steps are known so far; the rest of the live form is still to be added. */
export function StewardshipForm() {
  const [state, action, pending] = useForm(stewardshipApplication);
  const [step, setStep] = useState(1);
  const [first, setFirst] = useState({ name: "", email: "", phone: "" });
  const formRef = useRef<HTMLFormElement>(null);

  const next = () => {
    if (formRef.current?.reportValidity()) setStep(2);
  };

  return (
    <form ref={formRef} className="host-form" action={action}>
      <p className="steps-line">Step {step} of 2</p>
      {step === 1 ? (
        <>
          <label>
            <span>Full name <span className="req">*</span></span>
            <input type="text" name="name" autoComplete="name" placeholder="Jane Doe" value={first.name} onChange={(e) => setFirst({ ...first, name: e.target.value })} required />
          </label>
          <label>
            <span>Email address <span className="req">*</span></span>
            <input type="email" name="email" autoComplete="email" placeholder="jane@example.com" value={first.email} onChange={(e) => setFirst({ ...first, email: e.target.value })} required />
          </label>
          <label className="full">
            <span>Phone (WhatsApp) <span className="req">*</span></span>
            <input type="tel" name="phone" autoComplete="tel" placeholder="+1 000 000 0000" value={first.phone} onChange={(e) => setFirst({ ...first, phone: e.target.value })} required />
          </label>
          <div className="form-foot">
            <span />
            <button type="button" className="btn btn-primary" onClick={next}>Next step</button>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="name" value={first.name} />
          <input type="hidden" name="email" value={first.email} />
          <input type="hidden" name="phone" value={first.phone} />
          <h3 className="full" style={{ fontSize: 24 }}>About you</h3>
          <label>
            <span>Date of birth <span className="req">*</span></span>
            <input type="date" name="dob" required />
          </label>
          <label>
            <span>Nationality <span className="req">*</span></span>
            <input type="text" name="nationality" required />
          </label>
          <p className="full" style={{ color: "var(--muted)" }}>Where do you currently live?</p>
          <label>
            <span>City <span className="req">*</span></span>
            <input type="text" name="city" autoComplete="address-level2" required />
          </label>
          <label>
            <span>State / Province <span className="req">*</span></span>
            <input type="text" name="state" autoComplete="address-level1" required />
          </label>
          <label>
            <span>Country <span className="req">*</span></span>
            <input type="text" name="country" autoComplete="country-name" required />
          </label>
          <label>
            <span>Zip / Postal code <span className="req">*</span></span>
            <input type="text" name="zip" autoComplete="postal-code" required />
          </label>
          <fieldset>
            <legend>Who would be joining you at The ARK?</legend>
            {JOINING.map((j) => (
              <label key={j} className="choice">
                <input type="radio" name="joining" value={j} />
                {j}
              </label>
            ))}
          </fieldset>
          <label className="full">
            <span>What do you do, and could it be done from Costa Rica? <span className="req">*</span></span>
            <textarea name="work" rows={3} required />
          </label>
          <label className="full">
            <span>Tell us about yourself (background &amp; story) <span className="req">*</span></span>
            <textarea name="story" rows={4} required />
          </label>
          <Trap />
          {state.ok ? (
            <p className="form-thanks" role="status">{state.message}</p>
          ) : (
            <div className="form-foot">
              <span role="alert">{state.error ?? ""}</span>
              <span className="btn-row">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send application"}</button>
              </span>
            </div>
          )}
        </>
      )}
    </form>
  );
}
