"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Person = { id: string; name: string; email?: string | null; tier?: string | null };

/**
 * Optional "who was this for" field: search contacts by name, email or phone
 * and submit the chosen contact's id as `name`. Used for shop sales and
 * income, so they show up in that person's CRM activity.
 */
export function PersonPicker({
  name = "contact_id",
  label = "Person",
  initial,
  hint,
  onChange,
}: {
  name?: string;
  label?: string;
  initial?: Person | null;
  hint?: string;
  onChange?: (p: Person | null) => void;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(initial ?? null);

  useEffect(() => {
    if (picked || q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("shop_contact_search", { q: q.trim() });
      if (live) setMatches(data ?? []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked]);

  const set = (p: Person | null) => {
    setPicked(p);
    setQ("");
    setMatches([]);
    onChange?.(p);
  };
  const results = q.trim().length >= 2 ? matches : [];

  return (
    <div className="fld">
      <input type="hidden" name={name} value={picked?.id ?? ""} />
      <label htmlFor={`pp-${name}`}>{label}</label>
      {picked ? (
        <div className="pick-chip" style={{ marginBottom: 0 }}>
          <b>{picked.name}</b>
          <button type="button" className="linkish-sm" onClick={() => set(null)}>Change</button>
        </div>
      ) : (
        <>
          <input
            id={`pp-${name}`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone"
            autoComplete="off"
          />
          {results.length > 0 && (
            <div className="pick-list" role="listbox" aria-label="Matching people">
              {results.map((m) => (
                <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => set(m)}>
                  <b>{m.name}</b>
                  <span className="muted">{m.email || "No email"}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
