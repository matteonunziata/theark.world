"use client";

import Link from "next/link";
import { useState } from "react";
import { area, HOME_STATUS, inventoryName, label, LOT_KINDS, LOT_STATUS, statusTone } from "@/lib/estate";
import { MAP_POINTS, MAP_SIZE } from "@/lib/estate-map";
import { money } from "@/lib/schedule";

type MapLot = {
  id: string;
  code: string;
  name: string | null;
  kind: string;
  features: string | null;
  status: string;
  size_m2: number | null;
  price: number | null;
  currency: string;
  estate_lot_id: string | null;
  in_hospitality: boolean;
  home_status: string;
  home_name: string | null;
  owner: string | null;
};

export function MapView({ lots, initial }: { lots: MapLot[]; initial: string | null }) {
  const byCode = new Map(lots.map((l) => [l.code, l]));
  const [selected, setSelected] = useState<string | null>(initial && byCode.has(initial) ? initial : null);
  const [show, setShow] = useState<string>("");
  const lot = selected ? byCode.get(selected) : undefined;
  // An estate's lots light up together.
  const estateId = lot ? (lot.estate_lot_id ?? lot.id) : null;
  const main = lot ? (lots.find((l) => l.id === estateId) ?? lot) : undefined;
  const inGroup = (l: MapLot) => !!estateId && (l.id === estateId || l.estate_lot_id === estateId);
  const missing = lots.filter((l) => !MAP_POINTS[l.code]);
  const count = (s: string) => lots.filter((l) => l.status === s).length;

  return (
    <div className="map-layout">
      <div>
        <div className="pill-row" role="group" aria-label="Highlight">
          {[["", "Everything"], ...LOT_STATUS.filter(([k]) => count(k) > 0)].map(([k, l]) => (
            <button key={k} type="button" className="pill" aria-pressed={show === k} onClick={() => setShow(k)}>
              {k && <i className="map-key" style={{ ["--tone" as string]: statusTone[k] }} />}
              {l}
              <span className="muted" style={{ marginLeft: 6, fontWeight: 500 }}>{k ? count(k) : lots.length}</span>
            </button>
          ))}
        </div>
        <div className="map-scroll">
          <div className="map-box" style={{ aspectRatio: `${MAP_SIZE.width} / ${MAP_SIZE.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/estate-map.webp" alt="Site map of The ARK with every lot numbered" />
            {lots.map((l) => {
              const at = MAP_POINTS[l.code];
              if (!at) return null;
              const dim = !!show && l.status !== show;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`map-pin ${l.status} ${inGroup(l) ? "on" : ""} ${dim ? "dim" : ""}`}
                  style={{ left: `${at[0]}%`, top: `${at[1]}%`, ["--tone" as string]: statusTone[l.status] }}
                  aria-pressed={inGroup(l)}
                  aria-label={`${inventoryName(l, lots)}, ${label(LOT_STATUS, l.status)}`}
                  title={`${inventoryName(l, lots)} · ${label(LOT_STATUS, l.status)}`}
                  onClick={() => setSelected(selected === l.code ? null : l.code)}
                >
                  {l.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="panel map-side">
        {!main ? (
          <>
            <h2>Choose a lot</h2>
            <p className="muted" style={{ margin: 0 }}>
              Click any number on the map to see its status, size and price. Colours
              follow the live status, so they change as soon as a lot is reserved or sold.
            </p>
            <ul className="map-legend">
              {LOT_STATUS.map(([k, l]) => (
                <li key={k}>
                  <i className="map-key" style={{ ["--tone" as string]: statusTone[k] }} />
                  {l}
                  <span className="muted">{count(k)}</span>
                </li>
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
                Not on the map: {missing.map((l) => `Lot ${l.code}`).join(", ")}.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: "0 0 2px", fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>
              {label(LOT_KINDS, main.kind)}
            </p>
            <h2 style={{ marginBottom: 6 }}>{inventoryName(main, lots)}</h2>
            <span className="lot-pill inline" style={{ ["--tone" as string]: statusTone[main.status], marginLeft: 0 }}>
              {label(LOT_STATUS, main.status)}
            </span>
            {main.in_hospitality && <span className="lot-pill inline hosp">Hospitality</span>}
            <dl className="kv" style={{ marginTop: 14 }}>
              {main.features && (
                <>
                  <dt>Specifications</dt>
                  <dd>{main.features}</dd>
                </>
              )}
              <dt>Size</dt>
              <dd>{area(main.size_m2) ?? "—"}</dd>
              {main.status === "sold" || main.status === "not_for_sale" ? (
                <>
                  <dt>Owner</dt>
                  <dd>{main.owner ?? "—"}</dd>
                </>
              ) : (
                <>
                  <dt>Price</dt>
                  <dd>{main.price !== null ? money(main.price, main.currency) : "Not set"}</dd>
                </>
              )}
              {main.home_status !== "none" && (
                <>
                  <dt>Home</dt>
                  <dd>{[main.home_name, label(HOME_STATUS, main.home_status)].filter(Boolean).join(" · ")}</dd>
                </>
              )}
            </dl>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Link className="btn primary" href={`/estate/${main.id}`}>Open lot</Link>
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
