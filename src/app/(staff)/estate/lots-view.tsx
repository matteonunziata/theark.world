"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { area, byCode, inventoryName, label, LOT_STATUS, statusTone } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { saveLot } from "./actions";
import { LotFields } from "./lot-fields";

type Lot = Tables<"lots"> & { owner: string | null; household: number };

const FILTERS = [
  ["available", "Available"],
  ["reserved", "Reserved"],
  ["sold", "Sold"],
  ["hospitality", "In hospitality"],
  ["", "All lots"],
] as const;

export function LotsView({ lots, people }: { lots: Lot[]; people: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("available");
  const drawer = useDrawer<null>();
  const needle = q.trim().toLowerCase();
  // Lots that are part of an estate are listed under the estate.
  const entries = lots.filter((l) => !l.estate_lot_id);
  const match = (l: Lot) =>
    status === "hospitality" ? l.in_hospitality : !status || l.status === status;
  const list = entries
    .filter(
      (l) =>
        match(l) &&
        (!needle ||
          `${inventoryName(l, lots)} ${l.features ?? ""} ${l.owner ?? ""} ${l.zone ?? ""} ${l.home_name ?? ""}`
            .toLowerCase()
            .includes(needle)),
    )
    // Named homes, estates and shares first, then lots by number.
    .sort((a, b) => Number(!a.name) - Number(!b.name) || byCode(a, b));
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const forSale = entries.filter((l) => l.status === "available" && l.kind !== "fractional");
  const usd = forSale.filter((l) => l.currency === "USD").reduce((a, l) => a + Number(l.price ?? 0), 0);

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{lots.length}</b><span>Lots</span></div>
        <div className="stat"><b>{count("available")}</b><span>Available</span></div>
        <div className="stat"><b>{count("reserved")}</b><span>Reserved</span></div>
        <div className="stat"><b>{count("sold")}</b><span>Sold</span></div>
        {usd > 0 && <div className="stat"><b>{money(usd, "USD")}</b><span>Listed for sale</span></div>}
      </div>
      <div className="pill-row" role="group" aria-label="Show">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className="pill" aria-pressed={status === k} onClick={() => setStatus(k)}>
            {l}
            <span className="muted" style={{ marginLeft: 6, fontWeight: 500 }}>
              {k === "hospitality"
                ? entries.filter((x) => x.in_hospitality).length
                : k
                  ? entries.filter((x) => x.status === k).length
                  : entries.length}
            </span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input
          className="field-in search"
          type="search"
          placeholder="Search lot or estate"
          aria-label="Search lots"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Link className="btn" href="/estate/map">See the map</Link>
        <button type="button" className="btn primary" onClick={drawer.openNew}>
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
        <>
          <div className="list">
            <div className="row head inv-row">
              <span>Lot / estate</span>
              <span className="inv-spec">Specifications / size</span>
              <span className="inv-price">Live price (USD)</span>
            </div>
            {list.map((l) => {
              const sold = l.status === "sold" || l.status === "not_for_sale";
              return (
                <Link key={l.id} href={`/estate/${l.id}`} className="row inv-row" style={{ textDecoration: "none", color: "inherit" }}>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontWeight: 600 }}>{inventoryName(l, lots)}</b>
                    {(l.status !== "available" || l.in_hospitality) && (
                      <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, verticalAlign: "middle" }}>
                        {l.status !== "available" && (
                          <span className="lot-pill inline" style={{ ["--tone" as string]: statusTone[l.status], margin: 0 }}>
                            {label(LOT_STATUS, l.status)}
                          </span>
                        )}
                        {l.in_hospitality && <span className="lot-pill inline hosp" style={{ margin: 0 }}>Hospitality</span>}
                      </span>
                    )}
                    <span className="inv-sub muted">
                      {[l.features, area(l.size_m2)].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span className="inv-spec muted">
                    {[l.features, area(l.size_m2)].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="inv-price">
                    {sold ? (
                      <span className="muted">{l.owner ?? "—"}</span>
                    ) : l.price !== null ? (
                      <b style={{ fontWeight: 600 }}>{money(l.price, l.currency)}</b>
                    ) : (
                      <span className="muted">Not set</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="note">
            {list.length} {list.length === 1 ? "entry" : "entries"}
          </p>
        </>
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
        <LotFields people={people} lots={lots} />
      </Drawer>
    </>
  );
}
