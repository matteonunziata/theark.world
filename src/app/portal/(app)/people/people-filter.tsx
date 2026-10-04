"use client";

import Link from "next/link";
import { useState } from "react";
import type { DirEntry } from "@/lib/connect";
import { PersonCard } from "../../ui";

type Person = DirEntry & { cityName?: string; shared: string[] };

export function PeopleFilter({
  people,
  suggested,
  cityId,
  cityName,
  canMessage,
  meHasProfile,
}: {
  people: Person[];
  suggested: { id: string; why: string }[];
  cityId: string | null;
  cityName: string;
  canMessage: boolean;
  meHasProfile: boolean;
}) {
  const [tab, setTab] = useState<"here" | "suggested" | "all">(suggested.length ? "suggested" : "here");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const why = new Map(suggested.map((s) => [s.id, s.why]));
  const base =
    tab === "here"
      ? people.filter((p) => p.city_id === cityId)
      : tab === "suggested"
        ? suggested.map((s) => people.find((p) => p.id === s.id)).filter((p): p is Person => !!p)
        : people;
  const list = base.filter(
    (p) =>
      !needle ||
      [p.name, p.bio, p.cityName, ...p.interests].some((v) => String(v ?? "").toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="pv-pills" role="group" aria-label="Show">
        <button type="button" className="pv-pill" aria-pressed={tab === "suggested"} onClick={() => setTab("suggested")}>
          Suggested for you
        </button>
        <button type="button" className="pv-pill" aria-pressed={tab === "here"} onClick={() => setTab("here")}>
          In {cityName || "your city"}
        </button>
        <button type="button" className="pv-pill" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
          Everyone
        </button>
        <input
          className="pv-input"
          style={{ maxWidth: 260, marginLeft: "auto", padding: "8px 14px", borderRadius: 999 }}
          type="search"
          placeholder="Search names or interests"
          aria-label="Search members"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {tab === "suggested" && !meHasProfile && (
        <p style={{ color: "var(--pv-muted)", marginTop: -6 }}>
          <Link href="/portal/me" style={{ color: "var(--pv-sea)" }}>Add your interests</Link> and we’ll
          suggest people who share them.
        </p>
      )}
      {!list.length ? (
        <div className="pv-empty">
          <h3>{tab === "here" ? `No one in ${cityName || "this city"} yet` : "No one to show"}</h3>
          <p>
            {tab === "here"
              ? "When members say they’re here, they’ll show up. Try Everyone."
              : "Try another tab or a different search."}
          </p>
        </div>
      ) : (
        <div className="pv-grid">
          {list.map((p) => (
            <PersonCard
              key={p.id}
              p={p}
              cityName={p.cityName}
              why={tab === "suggested" ? why.get(p.id) : undefined}
              shared={p.shared}
              canMessage={canMessage}
            />
          ))}
        </div>
      )}
    </>
  );
}
