"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useDrawer } from "@/components/drawer";
import { firstName, lastName, tierColor } from "@/lib/crm";
import {
  type Contact,
  ContactDrawer,
  type DiscountOption,
  type Owner,
  type TierOption,
} from "../contact-drawer";
import { ImportDrawer } from "./import-drawer";

const FILTERS = [
  ["", "Everyone"],
  ["contact", "Contacts"],
  ["member", "Members"],
  ["steward", "Stewards"],
] as const;

export function PeopleView({
  contacts,
  owners,
  tiers,
  discounts,
  role,
}: {
  contacts: Contact[];
  owners: Owner[];
  tiers: TierOption[];
  discounts: DiscountOption[];
  role: string;
}) {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const drawer = useDrawer<Contact>();
  const [importing, setImporting] = useState(false);
  const canEdit = role === "admin" || role === "sales";

  const needle = q.trim().toLowerCase();
  const list = contacts.filter(
    (c) =>
      (!type || c.type === type) &&
      (!needle ||
        [c.name, c.email, c.phone, c.location, ...c.interests].some((v) =>
          String(v ?? "").toLowerCase().includes(needle),
        )),
  );

  return (
    <>
      <div className="pill-row" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            className="pill"
            aria-pressed={type === k}
            onClick={() => setType(k)}
          >
            {l}
            <span className="muted" style={{ marginLeft: 6, fontWeight: 500 }}>
              {k ? contacts.filter((c) => c.type === k).length : contacts.length}
            </span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input
          className="field-in search"
          type="search"
          placeholder="Search name, email, interests"
          aria-label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canEdit && (
          <button type="button" className="btn" onClick={() => setImporting(true)}>
            Import CSV
          </button>
        )}
        {canEdit && (
          <button type="button" className="btn primary" onClick={drawer.openNew}>
            Add {type === "steward" ? "steward" : type === "member" ? "member" : "contact"}
          </button>
        )}
      </div>

      {!list.length ? (
        <div className="empty">
          {contacts.length ? (
            <p>No one matches that.</p>
          ) : (
            <>
              <h2>No one here yet</h2>
              <p>
                Leads, waitlist, friends of The ARK, members, and the stewards
                on the land. Anyone you’re in conversation with.
              </p>
              {canEdit && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button type="button" className="btn primary" onClick={drawer.openNew}>
                    Add the first one
                  </button>
                  <button type="button" className="btn" onClick={() => setImporting(true)}>
                    Import a CSV
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="list">
            <div className="row head crow">
              <span>First name</span>
              <span>Last name</span>
              <span className="c-ct">Email</span>
              <span className="c-ph">Phone</span>
            </div>
            {list.map((c) => (
              <Link
                key={c.id}
                className="row crow"
                href={`/crm/contact/${c.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="who">
                  <Avatar name={c.name} color={tierColor(c.tier)} />
                  <b>{firstName(c.name)}</b>
                </span>
                <span>{lastName(c.name) || <span className="muted">—</span>}</span>
                <span className="c-ct" style={{ overflowWrap: "anywhere" }}>
                  {c.email || <span className="muted">—</span>}
                </span>
                <span className="c-ph">{c.phone || <span className="muted">—</span>}</span>
              </Link>
            ))}
          </div>
          <p className="note">
            {list.length} {list.length === 1 ? "person" : "people"}
          </p>
        </>
      )}

      {canEdit && (
        <ImportDrawer open={importing} onClose={() => setImporting(false)} type={type} />
      )}

      <ContactDrawer
        key={drawer.item?.id ?? `new-${type}`}
        open={drawer.open}
        contact={drawer.item}
        type={type || "contact"}
        owners={owners}
        tiers={tiers}
        discounts={discounts}
        isAdmin={role === "admin"}
        canEdit={canEdit}
        onClose={drawer.close}
      />
    </>
  );
}
