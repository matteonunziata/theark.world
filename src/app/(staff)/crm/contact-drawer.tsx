"use client";

import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { MSTATUS, PTYPES, ptypeName, TIERS } from "@/lib/crm";
import { saveContact } from "./actions";

export type Contact = Tables<"contacts">;
export type Owner = Pick<Tables<"team_members">, "id" | "name">;

export function ContactDrawer({
  open,
  contact,
  type = "contact",
  owners,
  isAdmin,
  canEdit,
  onClose,
}: {
  open: boolean;
  contact: Contact | null;
  type?: string;
  owners: Owner[];
  isAdmin: boolean;
  canEdit: boolean;
  onClose: () => void;
}) {
  const c = contact;
  const t = c?.type ?? type;
  const label = ptypeName(t).toLowerCase();
  return (
    <Drawer
      title={c ? `Edit ${label}` : `Add ${label}`}
      open={open}
      onClose={onClose}
      action={saveContact}
      footer={
        canEdit && (
          <>
            {c && isAdmin && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {c ? "Save changes" : `Add ${label}`}
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className="fld">
          <label htmlFor="c-name">Full name</label>
          <input id="c-name" name="name" defaultValue={c?.name} required />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-type">Type</label>
            <select id="c-type" name="type" defaultValue={t}>
              {PTYPES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="c-loc">Based in</label>
            <input id="c-loc" name="location" defaultValue={c?.location ?? ""} placeholder="e.g. Santa Teresa, nomad, Toronto" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" name="email" type="email" defaultValue={c?.email ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="c-phone">WhatsApp</label>
            <input id="c-phone" name="phone" type="tel" defaultValue={c?.phone ?? ""} placeholder="+506 …" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-ig">Instagram</label>
            <input id="c-ig" name="instagram" defaultValue={c?.instagram ?? ""} placeholder="@handle" />
          </div>
          <div className="fld">
            <label htmlFor="c-src">How we met</label>
            <input id="c-src" name="source" defaultValue={c?.source ?? ""} placeholder="e.g. Farm dinner, referral from Ana" />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="c-int">Interests</label>
          <input id="c-int" name="interests" defaultValue={(c?.interests ?? []).join(", ")} placeholder="yoga, surfing, regenerative farming, music" />
          <span className="hint">Separate with commas.</span>
        </div>
        {isAdmin && (
          <div className="fld">
            <label htmlFor="c-owner">Owner</label>
            <select id="c-owner" name="owner_id" defaultValue={c?.owner_id ?? ""}>
              <option value="">No one</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <span className="hint">Sales see the contacts they own.</span>
          </div>
        )}
        <div className="subhead">Membership</div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-tier">Tier</label>
            <select id="c-tier" name="tier" defaultValue={c?.tier ?? ""}>
              {TIERS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="c-ms">Status</label>
            <select id="c-ms" name="membership_status" defaultValue={c?.membership_status ?? "active"}>
              {MSTATUS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-start">Member since</label>
            <input id="c-start" name="member_since" type="date" defaultValue={c?.member_since ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="c-renew">Renews / ends</label>
            <input id="c-renew" name="renews_on" type="date" defaultValue={c?.renews_on ?? ""} />
          </div>
        </div>
        <p className="note" style={{ marginTop: -6 }}>
          Members with an active tier and an email can sign in to the members
          portal.
        </p>
        <div className="subhead">Land</div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-lot">Lot</label>
            <input id="c-lot" name="lot" defaultValue={c?.lot ?? ""} placeholder="e.g. 35B" />
          </div>
          <div className="fld">
            <label htmlFor="c-res">Living on-site</label>
            <select id="c-res" name="resident" defaultValue={c?.resident ? "yes" : ""}>
              <option value="">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
      </fieldset>
    </Drawer>
  );
}
