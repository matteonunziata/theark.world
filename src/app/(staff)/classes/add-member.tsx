"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { tierName } from "@/lib/crm";
import { addMemberToSession, searchMembers, type MemberHit } from "./actions";

export function AddMember({ offeringId, date }: { offeringId: string; date: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberHit[] | null>(null);
  const [picked, setPicked] = useState("");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  function show() {
    setOpen(true);
    start(async () => setMembers(await searchMembers(offeringId, date, "")));
  }

  function add() {
    const m = members?.find((x) => x.id === picked);
    if (!m) return;
    start(async () => {
      const res = await addMemberToSession(offeringId, date, m.id);
      if (res.ok) {
        toast(`${m.name} added`);
        setMembers((list) => list?.filter((x) => x.id !== m.id) ?? null);
        setPicked("");
      } else toast(res.error ?? "Couldn’t add them. Try again.");
    });
  }

  const needle = q.trim().toLowerCase();
  const shown = members?.filter((m) => !needle || m.name.toLowerCase().includes(needle) || m.id === picked) ?? null;

  if (!open) {
    return (
      <button type="button" className="btn" onClick={show}>
        Add a member
      </button>
    );
  }

  return (
    <div className="fld" style={{ maxWidth: 420, flex: "1 1 320px" }}>
      <label htmlFor="am-pick">Add a member to this class</label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search members by name"
        autoComplete="off"
        aria-label="Search members"
        disabled={members === null}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select
          id="am-pick"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          disabled={members === null}
          style={{ flex: 1 }}
        >
          <option value="">{members === null ? "Loading members…" : needle && shown?.length === 0 ? "No members match" : "Choose a member"}</option>
          {shown?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.tier ? ` · ${tierName(m.tier)}` : ""}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" disabled={pending || !picked} onClick={add}>
          Add
        </button>
      </div>
      {members?.length === 0 && <span className="hint">Every active member is already in this class.</span>}
    </div>
  );
}
