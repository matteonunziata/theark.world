"use client";

import { useEffect, useState, useTransition } from "react";
import { initials } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { avatarUrl } from "@/lib/covers";
import { tierName } from "@/lib/crm";
import { addMemberToSession, searchMembers, type MemberHit } from "./actions";

export function AddMember({ offeringId, date }: { offeringId: string; date: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      const r = q.trim().length < 2 ? [] : await searchMembers(offeringId, date, q);
      if (!stale) setHits(r);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, offeringId, date]);

  function add(m: MemberHit) {
    start(async () => {
      const res = await addMemberToSession(offeringId, date, m.id);
      if (res.ok) {
        toast(`${m.name} added`);
        setHits((h) => h.filter((x) => x.id !== m.id));
      } else toast(res.error ?? "Couldn’t add them. Try again.");
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Add a member
      </button>
    );
  }

  return (
    <div className="fld" style={{ maxWidth: 420, flex: "1 1 320px" }}>
      <label htmlFor="am-q">Add a member to this class</label>
      <input
        id="am-q"
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search members by name"
        autoComplete="off"
      />
      {q.trim().length >= 2 && !hits.length && <span className="hint">No members found.</span>}
      {hits.map((m) => {
        const photo = avatarUrl(m.photo_path);
        return (
          <div key={m.id} className="fac-sess">
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rphoto" src={photo} alt="" style={{ width: 32, height: 32 }} />
              ) : (
                <span className="rphoto" aria-hidden="true" style={{ width: 32, height: 32 }}>
                  {initials(m.name)}
                </span>
              )}
              <span>
                <b>{m.name}</b>
                <small>{m.tier ? tierName(m.tier) : "Member"}</small>
              </span>
            </span>
            <button type="button" className="btn primary" disabled={pending} onClick={() => add(m)}>
              Add
            </button>
          </div>
        );
      })}
    </div>
  );
}
