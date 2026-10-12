"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/drawer";
import { tierName } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import { addMember } from "./actions";

type Found = { id: string; name: string; email: string | null; tier: string | null; membership_status: string };
type Tier = { key: string; name: string };

/** "Add a member": search every contact (the team included) and give them a tier. */
export function AddMember({ tiers }: { tiers: Tier[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        Add a member
      </button>
      <Drawer
        title="Add a member"
        open={open}
        onClose={() => setOpen(false)}
        action={addMember}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Add member</button>
          </>
        }
      >
        <Body tiers={tiers} />
      </Drawer>
    </>
  );
}

function Body({ tiers }: { tiers: Tier[] }) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);

  useEffect(() => {
    // Characters that mean something in a PostgREST filter or an ILIKE.
    const term = q.replace(/[%,()*\\]/g, " ").trim();
    if (picked || term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("contacts")
        .select("id, name, email, tier, membership_status")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .order("name")
        .limit(10);
      if (live) setMatches((data as Found[] | null) ?? []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked]);

  const results = !picked && q.trim().length >= 2 ? matches : [];
  return (
    <>
      <div className="fld">
        <input type="hidden" name="contact_id" value={picked?.id ?? ""} />
        <label htmlFor="am-q">Person</label>
        {picked ? (
          <div className="pick-chip" style={{ marginBottom: 0 }}>
            <b>
              {picked.name}
              {picked.tier && picked.membership_status === "active" ? `, now ${tierName(picked.tier)}` : ""}
            </b>
            <button type="button" className="linkish-sm" onClick={() => { setPicked(null); setQ(""); setMatches([]); }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="am-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts and team by name, email or phone"
              autoComplete="off"
              autoFocus
            />
            {results.length > 0 && (
              <div className="pick-list" role="listbox" aria-label="Matching people">
                {results.map((m) => (
                  <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => setPicked(m)}>
                    <b>{m.name}</b>
                    <span className="muted">
                      {[m.email || "No email", m.tier && m.membership_status === "active" ? tierName(m.tier) : null]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !results.length && <span className="hint">No one found yet. Add new people in the CRM.</span>}
          </>
        )}
      </div>
      <div className="fld">
        <label htmlFor="am-tier">Tier</label>
        <select id="am-tier" name="tier" required defaultValue="">
          <option value="" disabled>Choose a tier</option>
          {tiers.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="am-from">Starts</label>
          <input id="am-from" name="starts" type="date" />
          <span className="hint">Leave empty for today.</span>
        </div>
        <div className="fld">
          <label htmlFor="am-to">Ends</label>
          <input id="am-to" name="ends" type="date" />
          <span className="hint">Leave empty for no end.</span>
        </div>
      </div>
    </>
  );
}
