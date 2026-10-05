"use client";

import { useState } from "react";
import { Drawer } from "@/components/drawer";
import { type BrandKey, LISTS } from "@/lib/marketing";
import { createCampaign } from "../actions";
import { BrandPicker } from "../nav";

/** Name it and pick the list; saving opens the editor to write it. */
export function NewCampaign({ brand }: { brand: BrandKey | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>New campaign</button>
      <Drawer
        title="New campaign"
        open={open}
        onClose={() => setOpen(false)}
        action={createCampaign}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Create and write</button>
          </>
        }
      >
        <div className="fld">
          <label htmlFor="nc-name">Name</label>
          <input id="nc-name" name="name" required placeholder="e.g. October farm shop opening" autoFocus />
          <span className="hint">For the team; people see the subject line.</span>
        </div>
        <div className="fld">
          <label htmlFor="nc-list">Send to</label>
          <select id="nc-list" name="list_key" defaultValue="waitlist">
            {LISTS.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </div>
        <BrandPicker value={brand ? [brand] : []} />
      </Drawer>
    </>
  );
}
