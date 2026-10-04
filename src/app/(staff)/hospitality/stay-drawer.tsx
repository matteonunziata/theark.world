"use client";

import { useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { lotTitle, nights, STAY_KINDS, STAY_SOURCES, STAY_STATUS } from "@/lib/estate";
import { money } from "@/lib/schedule";
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
          <input
            id="st-name"
            name="guest_name"
            required={guest}
            defaultValue={stay?.guest_name ?? ""}
            placeholder={guest ? "" : kind === "owner" ? "Owner" : "e.g. Repairs"}
          />
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
              <input id="st-email" name="email" type="email" defaultValue={stay?.email ?? ""} />
            </div>
            <div className="fld">
              <label htmlFor="st-phone">Phone or WhatsApp</label>
              <input id="st-phone" name="phone" type="tel" defaultValue={stay?.phone ?? ""} />
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
