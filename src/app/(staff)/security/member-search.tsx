"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { PASS_STATE, passOk } from "@/lib/pass";
import { type GateMatch, searchGate } from "./actions";

/** The fallback when a pass won't scan: find the person, open their pass. */
export function MemberSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<GateMatch[]>([]);
  const [busy, setBusy] = useState(false);

  // Results are only shown while the box holds a real query; the effect
  // just fetches, after a short pause in typing.
  const asked = q.trim().length >= 2;
  const shown = asked ? rows : [];
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await searchGate(needle).catch(() => []);
      if (live) {
        setRows(r);
        setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="section-title">Find a member or pass</h2>
      <div className="toolbar">
        <input
          className="field-in search"
          type="search"
          placeholder="Name, phone or email"
          aria-label="Find a member or pass holder"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        {busy && <span className="muted">Looking…</span>}
      </div>
      {asked && !busy && !shown.length && <p className="muted">Nobody matches that.</p>}
      {shown.length > 0 && (
        <div className="list">
          {shown.map((r) => {
            const ok = passOk(r.state);
            return (
              <div className="row chk static" key={r.contact_id}>
                <span className="who">
                  <Avatar name={r.name} color={ok ? "var(--leaf)" : "var(--slate)"} />
                  <span>
                    <b>{r.name}</b>
                    <span>
                      {r.tier_name ?? "No membership"}
                      {r.phone_hint ? ` · ${r.phone_hint}` : ""}
                    </span>
                  </span>
                </span>
                <span className="c-c2 muted">{r.tier_name ?? "No membership"}</span>
                <span className="c-t muted" style={{ fontSize: 13 }}>
                  {PASS_STATE[r.state] ?? "Not valid"}
                </span>
                <span className="acts">
                  <Link className={`btn${ok ? " primary" : ""}`} style={{ padding: "6px 10px" }} href={`/p/${r.pass_token}`}>
                    {ok ? "Open to check in" : "Open pass"}
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
