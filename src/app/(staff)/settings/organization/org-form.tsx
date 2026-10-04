"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { saveOrg } from "../actions";

export function OrgForm({
  org,
  canEdit,
}: {
  org: Tables<"org_settings"> | null;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(saveOrg, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state, toast]);

  return (
    <form className="form-card" action={action}>
      <fieldset disabled={!canEdit || pending} style={{ border: 0, padding: 0, margin: 0 }}>
        {!state.ok && state.error && <div className="form-error">{state.error}</div>}
        <div className="fld">
          <label htmlFor="o-name">Organization name</label>
          <input id="o-name" name="name" defaultValue={org?.name ?? ""} placeholder="The ARK" required />
        </div>
        <div className="fld">
          <label htmlFor="o-loc">Location</label>
          <input id="o-loc" name="location" defaultValue={org?.location ?? ""} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="o-cur">Main currency</label>
            <select id="o-cur" name="currency" defaultValue={org?.currency ?? "CRC"}>
              <option value="CRC">Costa Rican colón (₡)</option>
              <option value="USD">US dollar ($)</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="o-cur2">Show alongside</label>
            <select id="o-cur2" name="currency2" defaultValue={org?.currency2 ?? ""}>
              <option value="">Nothing</option>
              <option value="USD">US dollar ($)</option>
              <option value="CRC">Costa Rican colón (₡)</option>
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="o-tz">Time zone</label>
            <select id="o-tz" name="timezone" defaultValue={org?.timezone ?? "America/Costa_Rica"}>
              <option value="America/Costa_Rica">Costa Rica (UTC−6)</option>
              <option value="America/New_York">New York</option>
              <option value="America/Los_Angeles">Los Angeles</option>
              <option value="Europe/London">London</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="o-lang">Language</label>
            <select id="o-lang" name="language" defaultValue={org?.language ?? "en"}>
              <option value="en">English</option>
              <option value="es">Español (coming)</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="o-email">Contact email</label>
          <input id="o-email" name="email" type="email" defaultValue={org?.email ?? ""} placeholder="hello@theark.world" />
        </div>
        {canEdit && (
          <button type="submit" className="btn primary">
            {pending ? "Saving…" : "Save organization"}
          </button>
        )}
      </fieldset>
    </form>
  );
}
