"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { saveProfile } from "../../actions";

export function ProfileForm({
  me,
}: {
  me: {
    name: string;
    phone: string | null;
    bio: string | null;
    interests: string[];
    cities: string[];
    instagram: string | null;
    open_to_connect: boolean;
    show_in_directory: boolean;
  };
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(saveProfile, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);

  return (
    <form className="pv-form" action={action}>
      <div>
        <label htmlFor="pf-name">Your name</label>
        <input id="pf-name" name="name" className="pv-input" defaultValue={me.name} required minLength={2} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="pf-phone">WhatsApp number</label>
        <input id="pf-phone" name="phone" className="pv-input" type="tel" defaultValue={me.phone ?? ""} placeholder="+506 8888 8888" autoComplete="tel" />
        <div className="hint">With the country code. Shared with other members only if you’re open to hearing from them.</div>
      </div>
      <div>
        <label htmlFor="pf-bio">A few lines about you</label>
        <textarea id="pf-bio" name="bio" className="pv-input" rows={4} maxLength={600} defaultValue={me.bio ?? ""} placeholder="What you do, what you love, what you’re looking for here" />
      </div>
      <div>
        <label htmlFor="pf-cities">Cities you spend time in</label>
        <input id="pf-cities" name="cities" className="pv-input" defaultValue={me.cities.join(", ")} placeholder="Santa Teresa, Lisbon, New York" />
        <div className="hint">Separate with commas. We use these to suggest people who are often in the same places.</div>
      </div>
      <div>
        <label htmlFor="pf-int">Interests</label>
        <input id="pf-int" name="interests" className="pv-input" defaultValue={me.interests.join(", ")} placeholder="surfing, breathwork, ceramics, investing" />
        <div className="hint">Separate with commas. We use these to suggest people you might like to meet.</div>
      </div>
      <div>
        <label htmlFor="pf-ig">Instagram</label>
        <input id="pf-ig" name="instagram" className="pv-input" defaultValue={me.instagram ?? ""} placeholder="@handle" />
      </div>
      <label className="pv-switch">
        <input type="checkbox" name="show_in_directory" defaultChecked={me.show_in_directory} />
        <span>
          <b>Show me in the member directory</b>
          <br />
          <span style={{ color: "var(--pv-muted)" }}>Other members can find you under People.</span>
        </span>
      </label>
      <label className="pv-switch">
        <input type="checkbox" name="open_to_connect" defaultChecked={me.open_to_connect} />
        <span>
          <b>Open to hearing from members</b>
          <br />
          <span style={{ color: "var(--pv-muted)" }}>
            Members see a “Message on WhatsApp” button and your Instagram, and we may suggest you to people
            who share your interests or cities.
          </span>
        </span>
      </label>
      <div>
        <button type="submit" className="pv-btn" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
