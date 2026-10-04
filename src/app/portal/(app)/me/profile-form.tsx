"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { saveProfile } from "../../actions";

export function ProfileForm({
  me,
  cities,
}: {
  me: {
    bio: string | null;
    interests: string[];
    city_id: string | null;
    instagram: string | null;
    open_to_connect: boolean;
    show_in_directory: boolean;
  };
  cities: { id: string; name: string }[];
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
        <label htmlFor="pf-city">Where you are now</label>
        <select id="pf-city" name="city_id" className="pv-input" defaultValue={me.city_id ?? ""}>
          <option value="">Not saying</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pf-bio">A few lines about you</label>
        <textarea id="pf-bio" name="bio" className="pv-input" rows={4} maxLength={600} defaultValue={me.bio ?? ""} placeholder="What you do, what you love, what you’re looking for here" />
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
          <b>Open to messages and introductions</b>
          <br />
          <span style={{ color: "var(--pv-muted)" }}>
            Members can message you, and we may suggest you to people who share your interests.
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
