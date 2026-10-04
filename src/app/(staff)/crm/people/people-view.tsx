"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useDrawer } from "@/components/drawer";
import { mstatusName, tierClass, tierColor, tierName } from "@/lib/crm";
import {
  type Contact,
  ContactDrawer,
  type DiscountOption,
  type Owner,
  type TierOption,
} from "../contact-drawer";

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
                <button type="button" className="btn primary" onClick={drawer.openNew}>
                  Add the first one
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="list">
            <div className="row head crow">
              <span>Person</span>
              <span className="c-ct">Contact</span>
              <span className="c-int">Interests</span>
              <span>Membership or lot</span>
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
                  <span style={{ minWidth: 0 }}>
                    <b>{c.name}</b>
                    <span>{c.location || c.source || ""}</span>
                  </span>
                </span>
                <span className="c-ct muted" style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>
                  {c.email}
                  {c.email && c.phone && <br />}
                  {c.phone}
                </span>
                <span className="c-int tags">
                  {c.interests.length ? (
                    c.interests.slice(0, 3).map((i) => (
                      <span className="tag" key={i}>{i}</span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
                <span>
                  {c.type === "steward" ? (
                    c.lot ? `Lot ${c.lot}` : <span className="muted">—</span>
                  ) : (
                    <>
                      <span className={`tier ${tierClass(c.tier)}`}>{tierName(c.tier)}</span>
                      {c.tier && c.membership_status !== "active" && (
                        <span className="ptype" style={{ marginLeft: 6 }}>
                          {mstatusName(c.membership_status)}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
          <p className="note">
            {list.length} {list.length === 1 ? "person" : "people"}
          </p>
        </>
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
