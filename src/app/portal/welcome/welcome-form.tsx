"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { PhotoField } from "../(app)/me/photo-field";
import { completeOnboarding } from "../actions";

export function WelcomeForm({
  me,
}: {
  me: {
    name: string;
    email: string | null;
    phone: string | null;
    instagram: string | null;
    bio: string | null;
    cities: string[];
    photo_path: string | null;
    open_to_connect: boolean;
  };
}) {
  const [state, action, pending] = useActionState(completeOnboarding, { ok: false } as ActionResult);

  return (
    <form className="pv-form pv-panel" action={action}>
      {!state.ok && state.error && (
        <p className="pv-form-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="pv-step">
        <span className="n">1</span>
        <div>
          <h2>You</h2>
          <p>A photo helps the team and other members greet you by name.</p>
        </div>
      </div>
      <PhotoField name={me.name} initial={me.photo_path} />
      <div>
        <label htmlFor="wf-name">Your name</label>
        <input id="wf-name" name="name" className="pv-input" defaultValue={me.name} required minLength={2} autoComplete="name" />
      </div>

      <div className="pv-step">
        <span className="n">2</span>
        <div>
          <h2>How to reach you</h2>
          <p>Members message each other on WhatsApp. Your email is only for us.</p>
        </div>
      </div>
      <div>
        <label htmlFor="wf-phone">WhatsApp number</label>
        <input id="wf-phone" name="phone" className="pv-input" type="tel" defaultValue={me.phone ?? ""} placeholder="+506 8888 8888" autoComplete="tel" />
        <div className="hint">With the country code.</div>
      </div>
      <div>
        <label htmlFor="wf-email">Email</label>
        <input id="wf-email" className="pv-input" type="email" value={me.email ?? ""} readOnly aria-describedby="wf-email-hint" />
        <div className="hint" id="wf-email-hint">The one you signed in with. Write to us if it needs changing.</div>
      </div>
      <div>
        <label htmlFor="wf-ig">Instagram <span className="opt">optional</span></label>
        <input id="wf-ig" name="instagram" className="pv-input" defaultValue={me.instagram ?? ""} placeholder="@handle" />
      </div>

      <div className="pv-step">
        <span className="n">3</span>
        <div>
          <h2>A little about you</h2>
          <p>What you do, what you love, what you’re hoping to find here.</p>
        </div>
      </div>
      <div>
        <label htmlFor="wf-bio">Quick bio</label>
        <textarea id="wf-bio" name="bio" className="pv-input" rows={4} maxLength={600} defaultValue={me.bio ?? ""} placeholder="Surf in the mornings, build things in the afternoons. Here for the people and the padel." />
      </div>
      <div>
        <label htmlFor="wf-cities">Cities you spend time in</label>
        <input id="wf-cities" name="cities" className="pv-input" defaultValue={me.cities.join(", ")} placeholder="Santa Teresa, Lisbon, New York" />
        <div className="hint">Separate with commas. We’ll suggest members who are often in the same places.</div>
      </div>

      <label className="pv-switch">
        <input type="checkbox" name="open_to_connect" defaultChecked={me.open_to_connect} />
        <span>
          <b>Open to hearing from members</b>
          <br />
          <span style={{ color: "var(--pv-muted)" }}>
            Other members see a “Message on WhatsApp” button and your Instagram on your profile.
          </span>
        </span>
      </label>

      <div>
        <button type="submit" className="pv-btn" disabled={pending}>
          {pending ? "Saving…" : "Into the portal"}
        </button>
      </div>
    </form>
  );
}
