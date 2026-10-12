"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/drawer";
import { createClient } from "@/lib/supabase/client";
import { addStewardToLot } from "../actions";

type Found = { id: string; name: string; email: string | null };
type Lot = { id: string; code: string; name: string | null };

/** "Add a steward": search every contact (the team included) and pick the lot they own. */
export function AddSteward({ lots }: { lots: Lot[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        Add a steward
      </button>
      <Drawer
        title="Add a steward"
        open={open}
        onClose={() => setOpen(false)}
        action={addStewardToLot}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Add steward</button>
          </>
        }
      >
        <Body lots={lots} />
      </Drawer>
    </>
  );
}

function Body({ lots }: { lots: Lot[] }) {
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
        .select("id, name, email")
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
        <label htmlFor="as-q">Person</label>
        {picked ? (
          <div className="pick-chip" style={{ marginBottom: 0 }}>
            <b>{picked.name}</b>
            <button type="button" className="linkish-sm" onClick={() => { setPicked(null); setQ(""); setMatches([]); }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="as-q"
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
                    <span className="muted">{m.email || "No email"}</span>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !results.length && <span className="hint">No one found yet. Add new people in the CRM.</span>}
          </>
        )}
      </div>
      <div className="fld">
        <label htmlFor="as-lot">Lot they own</label>
        <select id="as-lot" name="lot_id" required defaultValue="">
          <option value="" disabled>Choose a lot</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>{l.code}{l.name ? `, ${l.name}` : ""}</option>
          ))}
        </select>
        <span className="hint">To add the same person to another lot, add them again.</span>
      </div>
    </>
  );
}
