"use client";

import { useEffect, useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { lotTitle, nights, STAY_KINDS, STAY_SOURCES, STAY_STATUS } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import { saveStay } from "../estate/actions";

export type Stay = Tables<"stays">;
export type Home = Pick<
  Tables<"lots">,
  "id" | "code" | "name" | "nightly_rate" | "rate_currency" | "max_guests" | "min_nights" | "in_hospitality"
>;

/** Book a stay, block dates, or edit an existing stay. */
export function StayDrawer({
  open,
  onClose,
  stay,
  homes,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  stay: Stay | null;
  homes: Home[];
  defaults?: { lot_id?: string; check_in?: string; check_out?: string };
}) {
  const [lotId, setLotId] = useState(stay?.lot_id ?? defaults?.lot_id ?? homes[0]?.id ?? "");
  const [kind, setKind] = useState(stay?.kind ?? "guest");
  const [checkIn, setCheckIn] = useState(stay?.check_in ?? defaults?.check_in ?? "");
  const [checkOut, setCheckOut] = useState(stay?.check_out ?? defaults?.check_out ?? "");
  const home = homes.find((h) => h.id === lotId);
  const n = checkIn && checkOut && checkOut > checkIn ? nights(checkIn, checkOut) : 0;
  const guest = kind === "guest";
  const [name, setName] = useState(stay?.guest_name ?? "");
  const [email, setEmail] = useState(stay?.email ?? "");
  const [phone, setPhone] = useState(stay?.phone ?? "");
  const [contactId, setContactId] = useState(stay?.contact_id ?? "");

  return (
    <Drawer
      title={stay ? "Edit stay" : "Book a stay"}
      open={open}
      onClose={onClose}
      action={saveStay}
      footer={
        <>
          {stay && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{stay ? "Save" : guest ? "Book" : "Block dates"}</button>
        </>
      }
    >
      {stay && <input type="hidden" name="id" value={stay.id} />}
      <input type="hidden" name="contact_id" value={guest ? contactId : ""} />
      {stay?.source === "guesty" && (
        <p className="note" style={{ marginTop: 0 }}>
          Booked on {stay.channel ?? "Guesty"} through Guesty{stay.external_ref ? ` (${stay.external_ref})` : ""}. Dates,
          guest, status and payment come from Guesty at each sync, so change those there
          {stay.external_id ? (
            <>
              {" "}
              (<a href={`https://app.guesty.com/reservations/${stay.external_id}`} target="_blank" rel="noreferrer">open in Guesty</a>)
            </>
          ) : null}
          . Notes stay as you write them here.
        </p>
      )}
      <div className="grid2">
        <div className="fld">
          <label htmlFor="st-lot">Home</label>
          <select id="st-lot" name="lot_id" value={lotId} onChange={(e) => setLotId(e.target.value)} required>
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {lotTitle(h)}{h.name ? ` (Lot ${h.code})` : ""}{h.in_hospitality ? "" : " · not listed"}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="st-kind">Type</label>
          <select id="st-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {STAY_KINDS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="st-in">Check-in</label>
          <input id="st-in" name="check_in" type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="st-out">Check-out</label>
          <input id="st-out" name="check_out" type="date" required min={checkIn || undefined} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>
      {n > 0 && (
        <p className="muted" style={{ margin: "-6px 0 14px", fontSize: 13.5 }}>
          {n} night{n === 1 ? "" : "s"}
          {guest && home?.nightly_rate ? `, ${money(Number(home.nightly_rate) * n, home.rate_currency)} at the listed rate` : ""}
          {guest && home && n < home.min_nights ? `. This home has a ${home.min_nights}-night minimum.` : ""}
        </p>
      )}
      <div className="grid2">
        <div className="fld">
          <label htmlFor="st-name">{guest ? "Guest name" : "Label"}</label>
          {guest ? (
            <GuestName
              name={name}
              linked={!!contactId}
              setName={setName}
              onPick={(c) => {
                setName(c.name);
                setContactId(c.id);
                if (c.email) setEmail(c.email);
                if (c.phone) setPhone(c.phone);
              }}
              onUnlink={() => setContactId("")}
            />
          ) : (
            <input
              id="st-name"
              name="guest_name"
              defaultValue={stay?.guest_name ?? ""}
              placeholder={kind === "owner" ? "Owner" : "e.g. Repairs"}
            />
          )}
        </div>
        <div className="fld">
          <label htmlFor="st-status">Status</label>
          <select id="st-status" name="status" defaultValue={stay?.status ?? "confirmed"}>
            {STAY_STATUS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      {guest && (
        <>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="st-email">Email</label>
              <input id="st-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="st-phone">Phone or WhatsApp</label>
              <input id="st-phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="st-guests">Guests</label>
              <input id="st-guests" name="guests" type="number" min={1} max={home?.max_guests ?? undefined} defaultValue={stay?.guests ?? ""} />
            </div>
            <div className="fld">
              <label htmlFor="st-src">Booked through</label>
              <select id="st-src" name="source" defaultValue={stay?.source ?? "direct"}>
                {STAY_SOURCES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="st-rate">Nightly rate</label>
              <input id="st-rate" name="nightly_rate" inputMode="decimal" defaultValue={stay?.nightly_rate ?? ""} placeholder={home?.nightly_rate ? String(home.nightly_rate) : ""} />
            </div>
            <div className="fld">
              <label htmlFor="st-total">Total</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input id="st-total" name="total" inputMode="decimal" defaultValue={stay?.total ?? ""} placeholder="Rate × nights" style={{ flex: 1 }} />
                <select name="currency" aria-label="Currency" defaultValue={stay?.currency ?? home?.rate_currency ?? "USD"} style={{ width: 84 }}>
                  <option>USD</option>
                  <option>CRC</option>
                </select>
              </div>
            </div>
          </div>
          <label className="check" style={{ marginBottom: 14 }}>
            <input type="checkbox" name="paid" defaultChecked={stay?.paid ?? false} />
            Paid
          </label>
        </>
      )}
      <div className="fld">
        <label htmlFor="st-notes">Notes</label>
        <textarea id="st-notes" name="notes" rows={3} defaultValue={stay?.notes ?? ""} placeholder={guest ? "Arrival time, requests, transfers" : ""} />
      </div>
    </Drawer>
  );
}

type Found = { id: string; name: string; email: string | null; phone: string | null };

/** Guest name that searches ARK OS contacts first; if no one matches, offer to add them. */
function GuestName({
  name,
  linked,
  setName,
  onPick,
  onUnlink,
}: {
  name: string;
  linked: boolean;
  setName: (v: string) => void;
  onPick: (c: Found) => void;
  onUnlink: () => void;
}) {
  const [matches, setMatches] = useState<Found[]>([]);
  const [searched, setSearched] = useState("");
  const [shut, setShut] = useState(false);
  const term = name.replace(/[%,()*\\]/g, " ").trim();

  useEffect(() => {
    if (linked || term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("contacts")
        .select("id, name, email, phone")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .order("name")
        .limit(8);
      if (!live) return;
      setMatches((data as Found[] | null) ?? []);
      setSearched(term);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term, linked]);

  const ready = !linked && term.length >= 2 && searched === term;
  const list = ready && !shut ? matches : [];
  return (
    <>
      <input
        id="st-name"
        name="guest_name"
        required
        autoComplete="off"
        value={name}
        placeholder="Search contacts or type a new name"
        onChange={(e) => {
          setName(e.target.value);
          setShut(false);
          if (linked) onUnlink();
        }}
      />
      {linked && <span className="hint">Linked to a contact in the CRM. Typing a different name unlinks it.</span>}
      {list.length > 0 && (
        <div className="pick-list" role="listbox" aria-label="Matching contacts">
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onPick(m);
                setShut(true);
              }}
            >
              <b>{m.name}</b>
              <span className="muted">{m.email || m.phone || "No email"}</span>
            </button>
          ))}
        </div>
      )}
      {ready && !matches.length && (
        <label className="check" style={{ marginTop: 8 }}>
          <input type="checkbox" name="add_contact" defaultChecked />
          Not in ARK OS yet. Add {term} to the CRM
        </label>
      )}
    </>
  );
}
