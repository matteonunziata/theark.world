"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { money, PLANS, passUrl } from "../plans";
import { applyForMembership } from "./actions";

const STEPS = ["Start here", "Why The ARK", "What you bring", "Your place here"];
const LABELS: Record<string, string> = {
  month: "1-Month Membership",
  quarter: "3-Month Membership",
  half: "6-Month Membership",
  year: "Annual Membership",
};
const DRAWN_TO = ["Classes / Workshops", "Gym / Spa Deck", "Co-Work", "Padel / Pickleball"];

export function ApplyForm({ plan: initialPlan, utm }: { plan: string; utm: Record<string, string> }) {
  const [state, action, pending] = useActionState(applyForMembership, { ok: false } as ActionResult);
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(initialPlan);
  const [firstName, setFirstName] = useState("");
  const [stepError, setStepError] = useState("");
  const steps = useRef<(HTMLFieldSetElement | null)[]>([]);
  const chosen = PLANS.find((p) => p.key === plan);

  if (state.ok) {
    return (
      <div className="ms-apply-card ms-done">
        <h2>Application received</h2>
        <p>
          Thank you{firstName ? `, ${firstName}` : ""}. Our stewardship team reads every application
          with care, and we’ll reach out by WhatsApp or email within a day or two. We’re also emailing you a free day pass: come for a day on us, any time in the next 90 days.
        </p>
        <Link href="/ark-membership" className="ms-btn">
          Back to membership
        </Link>
      </div>
    );
  }

  const go = (to: number) => {
    setStepError("");
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const fs = steps.current[step];
    const fields = fs ? [...fs.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")] : [];
    if (!fields.every((f) => f.reportValidity())) return;
    if (step === 1) {
      if (!chosen) return setStepError("Choose a pass or membership.");
      // Passes need no application.
      if (chosen.kind === "pass") {
        window.location.assign(passUrl(chosen.key));
        return;
      }
    }
    go(step + 1);
  };

  return (
    <form
      className="ms-apply-card"
      // Submitted by hand so a server error doesn't clear everyone's answers.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <ol className="ms-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i <= step ? "on" : ""} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {Object.entries(utm).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input name="hp_contact" tabIndex={-1} autoComplete="off" aria-hidden="true" className="ms-hp" />

      <fieldset hidden={step !== 0} ref={(el) => { steps.current[0] = el; }}>
        <legend>Let’s start with you</legend>
        <div className="ms-grid2">
          <div className="ms-f">
            <label htmlFor="a-first">First name</label>
            <input
              id="a-first"
              name="first_name"
              autoComplete="given-name"
              required
              onChange={(e) => setFirstName(e.target.value.trim())}
            />
          </div>
          <div className="ms-f">
            <label htmlFor="a-last">Last name</label>
            <input id="a-last" name="last_name" autoComplete="family-name" required />
          </div>
          <div className="ms-f">
            <label htmlFor="a-phone">WhatsApp</label>
            <input id="a-phone" name="phone" type="tel" autoComplete="tel" placeholder="+506 8888 8888" required minLength={6} />
          </div>
          <div className="ms-f">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" name="email" type="email" autoComplete="email" required />
          </div>
        </div>
      </fieldset>

      <fieldset hidden={step !== 1} ref={(el) => { steps.current[1] = el; }}>
        <legend>Why The ARK</legend>
        <p className="ms-q">Which membership are you interested in?</p>
        <div className="ms-tiers">
          {PLANS.map((p) => (
            <label key={p.key} className={plan === p.key ? "on" : ""}>
              <input
                type="radio"
                name="plan"
                value={p.key}
                checked={plan === p.key}
                onChange={() => {
                  setPlan(p.key);
                  setStepError("");
                }}
              />
              <span>
                <b>{LABELS[p.key] ?? p.name}</b>
                <span className="ms-where">{money(p.price, "CRC")}</span>
                {p.kind === "pass" && <em>No application needed — pay and go</em>}
              </span>
            </label>
          ))}
        </div>
        <div className="ms-f">
          <label htmlFor="a-invited">Who were you invited by?</label>
          <input id="a-invited" name="invited_by" placeholder="A name, if someone invited you" />
        </div>
      </fieldset>

      <fieldset hidden={step !== 2} ref={(el) => { steps.current[2] = el; }}>
        <legend>What you bring</legend>
        <div className="ms-f">
          <label htmlFor="a-building">What are you building, creating, or working on — in work or in life?</label>
          <textarea id="a-building" name="building" rows={4} required maxLength={4000} />
        </div>
        <div className="ms-f">
          <label htmlFor="a-why">Why would you like to become an ARK member?</label>
          <textarea id="a-why" name="why_join" rows={4} required maxLength={4000} />
        </div>
        <div className="ms-f">
          <label htmlFor="a-contrib">
            How do you see yourself contributing to the community here — a skill, a craft, energy, a
            network, something you could teach or share?
          </label>
          <textarea id="a-contrib" name="contributing" rows={4} required maxLength={4000} />
        </div>
        <p className="ms-q">
          What part of The ARK are you most drawn to? <span className="ms-where">Choose any</span>
        </p>
        <div className="ms-checks">
          {DRAWN_TO.map((d) => (
            <label key={d}>
              <input type="checkbox" name="drawn_to" value={d} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset hidden={step !== 3} ref={(el) => { steps.current[3] = el; }}>
        <legend>Your place here</legend>
        <p className="ms-q">
          If you could invite three people into this community — people whose energy, work, or way of
          living feels aligned with The ARK — who would they be?{" "}
          <span className="ms-where">Optional, names only</span>
        </p>
        <div className="ms-grid3">
          {[1, 2, 3].map((n) => (
            <input key={n} name="invite" aria-label={`Name ${n}`} placeholder={`Name ${n}`} maxLength={120} />
          ))}
        </div>
      </fieldset>

      {(stepError || (!state.ok && state.error)) && (
        <div className="ms-error" role="alert">
          {stepError || state.error}
        </div>
      )}

      <div className="ms-nav-row">
        {step > 0 ? (
          <button type="button" className="ms-btn" onClick={() => go(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="ms-btn solid" onClick={next}>
            {step === 1 && chosen?.kind === "pass" ? "Continue to payment" : "Continue"}
          </button>
        ) : (
          <button type="submit" className="ms-btn solid" disabled={pending}>
            {pending ? "Sending…" : "Send application"}
          </button>
        )}
      </div>
      <p className="ms-fine ms-center">Only The ARK’s stewardship team sees your answers.</p>
    </form>
  );
}
