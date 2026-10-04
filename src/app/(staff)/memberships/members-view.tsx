"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { TIERS, tierClass, tierColor, tierName } from "@/lib/crm";

type M = {
  id: string;
  name: string;
  tier: string | null;
  location: string | null;
  interests: string[];
};

export function MembersView({ members }: { members: M[] }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const needle = q.trim().toLowerCase();
  const list = members.filter(
    (m) =>
      (!tier || m.tier === tier) &&
      (!needle ||
        [m.name, m.location, ...m.interests].some((v) =>
          String(v ?? "").toLowerCase().includes(needle),
        )),
  );
  return (
    <>
      <div className="toolbar">
        <input
          className="field-in search"
          type="search"
          placeholder="Search members or interests"
          aria-label="Search members"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field-in" aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          {TIERS.slice(1).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      {!list.length ? (
        <div className="empty">
          <p>
            {members.length
              ? "No one matches that."
              : "No active members yet. Give a contact a tier in the CRM and they show up here."}
          </p>
        </div>
      ) : (
        <div className="dir">
          {list.map((m) => (
            <Link className="mcard" href={`/crm/contact/${m.id}`} key={m.id}>
              <Avatar name={m.name} color={tierColor(m.tier)} />
              <h3>{m.name}</h3>
              <span className={`tier ${tierClass(m.tier)}`}>{tierName(m.tier)}</span>
              <div className="sub">{[m.location, ...m.interests.slice(0, 2)].filter(Boolean).join(", ")}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
