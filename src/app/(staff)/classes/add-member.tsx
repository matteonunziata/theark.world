"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { tierName } from "@/lib/crm";
import { addMemberToSession, searchMembers, type MemberHit } from "./actions";

export function AddMember({ offeringId, date }: { offeringId: string; date: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[] | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    let stale = false;
    const t = setTimeout(
      () =>
        searchMembers(offeringId, date, query).then((r) => {
          if (!stale) setHits(r);
        }),
      query ? 200 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [open, query, offeringId, date]);

  function add(m: MemberHit) {
    start(async () => {
      const res = await addMemberToSession(offeringId, date, m.id);
      if (res.ok) {
        toast(`${m.name} added`);
        setHits((list) => list?.filter((x) => x.id !== m.id) ?? null);
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
      <label htmlFor="am-search">Add a member to this class</label>
      <input
        id="am-search"
        type="search"
        autoFocus
        autoComplete="off"
        placeholder="Search by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 6 }}>
        {hits === null && <span className="hint">Loading members…</span>}
        {hits?.slice(0, 50).map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
            <span style={{ flex: 1 }}>
              {m.name}
              {m.tier ? ` · ${tierName(m.tier)}` : ""}
            </span>
            <button type="button" className="btn primary" disabled={pending} onClick={() => add(m)}>
              Add
            </button>
          </div>
        ))}
      </div>
      {hits && hits.length > 50 && <span className="hint">Showing the first 50. Keep typing to narrow it down.</span>}
      {hits?.length === 0 && (
        <span className="hint">{query ? "No active member matches that name." : "Every active member is already in this class."}</span>
      )}
    </div>
  );
}
