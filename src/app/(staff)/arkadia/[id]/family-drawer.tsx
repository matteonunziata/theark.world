"use client";

import { useEffect, useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { saveGuardian, searchContacts } from "../actions";

type Guardian = Tables<"student_guardians">;
type Match = { id: string; name: string; email: string | null; phone: string | null };

/** Add a family member from the CRM, or as a new person (saved to the CRM too). */
export function FamilyDrawer({
  open,
  onClose,
  studentId,
  guardian,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  guardian: Guardian | null;
}) {
  const g = guardian;
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [name, setName] = useState(g?.name ?? "");
  const [email, setEmail] = useState(g?.email ?? "");
  const [phone, setPhone] = useState(g?.phone ?? "");

  useEffect(() => {
    if (g || picked || q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchContacts(q);
      if (live) setMatches(r);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, g, picked]);

  const pick = (m: Match) => {
    setPicked(m);
    setName(m.name);
    setEmail(m.email ?? "");
    setPhone(m.phone ?? "");
  };
  const unpick = () => {
    setPicked(null);
    setName("");
    setEmail("");
    setPhone("");
  };
  const results = q.trim().length >= 2 ? matches : [];

  return (
    <Drawer
      title={g ? "Edit family member" : "Add a family member"}
      open={open}
      onClose={onClose}
      action={saveGuardian}
      footer={
        <>
          {g && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </>
      }
    >
      <input type="hidden" name="student_id" value={studentId} />
      {g && <input type="hidden" name="id" value={g.id} />}
      {picked && <input type="hidden" name="contact_id" value={picked.id} />}

      {!g &&
        (picked ? (
          <div className="pick-chip">
            <span>
              From the CRM: <b>{picked.name}</b>
            </span>
            <button type="button" className="linkish-sm" onClick={unpick}>Choose someone else</button>
          </div>
        ) : (
          <div className="fld">
            <label htmlFor="f-find">Find in contacts</label>
            <input
              id="f-find"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email or phone"
              autoComplete="off"
            />
            {results.length > 0 && (
              <div className="pick-list" role="listbox" aria-label="Matching contacts">
                {results.map((m) => (
                  <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => pick(m)}>
                    <b>{m.name}</b>
                    <span className="muted">{[m.email, m.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
                  </button>
                ))}
              </div>
            )}
            <span className="hint">
              {q.trim().length >= 2 && !results.length
                ? "No one by that name yet. Fill in their details below and they’ll be added to the CRM."
                : "Not in the CRM yet? Fill in their details below and they’ll be added."}
            </span>
          </div>
        ))}

      <div className="grid2">
        <div className="fld">
          <label htmlFor="f-name">Name</label>
          <input id="f-name" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="f-rel">Relation</label>
          <input id="f-rel" name="relation" defaultValue={g?.relation ?? ""} placeholder="Mother, father, guardian" />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="f-email">Email</label>
          <input id="f-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="f-phone">Phone or WhatsApp</label>
          <input id="f-phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
    </Drawer>
  );
}
