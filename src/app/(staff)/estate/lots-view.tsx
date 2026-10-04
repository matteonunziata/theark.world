"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { area, estatePhoto, label, LOT_STATUS, lotTitle, statusTone } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { saveLot } from "./actions";
import { LotFields } from "./lot-fields";

type Lot = Tables<"lots"> & { owner: string | null; household: number };

export function LotsView({ lots, people }: { lots: Lot[]; people: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const drawer = useDrawer<null>();
  const needle = q.trim().toLowerCase();
  const list = lots.filter(
    (l) =>
      (!status || (status === "hospitality" ? l.in_hospitality : l.status === status)) &&
      (!needle ||
        `${l.code} ${l.name ?? ""} ${l.owner ?? ""} ${l.zone ?? ""} ${l.home_name ?? ""}`.toLowerCase().includes(needle)),
  );
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const forSale = lots.filter((l) => l.status === "available");
  const usd = forSale.filter((l) => l.currency === "USD").reduce((a, l) => a + Number(l.price ?? 0), 0);

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{lots.length}</b><span>Lots</span></div>
        <div className="stat"><b>{count("available")}</b><span>Available</span></div>
        <div className="stat"><b>{count("reserved")}</b><span>Reserved</span></div>
        <div className="stat"><b>{count("sold")}</b><span>Sold</span></div>
        <div className="stat"><b>{lots.filter((l) => l.in_hospitality).length}</b><span>In hospitality</span></div>
        {usd > 0 && <div className="stat"><b>{money(usd, "USD")}</b><span>Listed for sale</span></div>}
      </div>
      <div className="toolbar">
        <input className="field-in search" type="search" placeholder="Search lot, owner, home" aria-label="Search lots" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field-in" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All lots</option>
          {LOT_STATUS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
          <option value="hospitality">In hospitality</option>
        </select>
        <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
          Add a lot
        </button>
      </div>

      {!lots.length ? (
        <div className="empty">
          <h2>No lots yet</h2>
          <p>
            Add each lot with its size, price and photos. Each one gets its own
            page for the owner, the home, the household and its maintenance log.
          </p>
          <button type="button" className="btn primary" onClick={drawer.openNew}>Add the first lot</button>
        </div>
      ) : !list.length ? (
        <div className="empty"><p>No lots match.</p></div>
      ) : (
        <div className="lots">
          {list.map((l) => {
            const photo = estatePhoto(l.photo_path) ?? estatePhoto(l.aerial_path);
            return (
              <Link key={l.id} href={`/estate/${l.id}`} className="lot-card">
                <div className="lot-img">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" loading="lazy" />
                  ) : (
                    <span>Lot {l.code}</span>
                  )}
                  <span className="lot-pill" style={{ ["--tone" as string]: statusTone[l.status] }}>
                    {label(LOT_STATUS, l.status)}
                  </span>
                  {l.in_hospitality && <span className="lot-pill hosp">Hospitality</span>}
                </div>
                <div className="lot-body">
                  <b>{lotTitle(l)}</b>
                  <span className="muted">
                    {[l.name ? `Lot ${l.code}` : null, l.zone, area(l.size_m2)].filter(Boolean).join(" · ") || " "}
                  </span>
                  <span className="lot-foot">
                    {l.status === "sold" || l.status === "not_for_sale"
                      ? (l.owner ?? "Owner not set")
                      : l.price !== null
                        ? money(l.price, l.currency)
                        : "Price not set"}
                    {l.household > 0 && <span className="muted"> · {l.household} in household</span>}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Drawer
        title="Add a lot"
        open={drawer.open}
        onClose={drawer.close}
        action={saveLot}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Add lot</button>
          </>
        }
      >
        <LotFields people={people} />
      </Drawer>
    </>
  );
}
