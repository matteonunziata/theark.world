"use client";

import Link from "next/link";
import { useState } from "react";
import { MAP_POINTS, MAP_SIZE } from "@/lib/estate-map";
import type { Currency } from "@/lib/fx";
import type { PublicLot } from "@/lib/public-lots";

const CURRENCIES = ["USD", "CRC", "EUR", "CAD", "CHF", "ILS"] as const;

type Row = { key: string; codes: string[]; title: string; spec: string; usd: number };

/** Names as the inventory shows them: "Mountain House (Lot 4)", "Tanit Estate (Lot 10, 11, 12)", or "Lot 23". */
function rowsFor(lots: PublicLot[]): Row[] {
  const forSale = lots.filter((l) => l.status === "available");
  const rows: Row[] = [];
  for (const l of forSale) {
    if (l.estate_code) continue; // the estate's own row stands for these
    if (l.price == null) continue;
    const parts = forSale.filter((x) => x.estate_code === l.code).map((x) => x.code);
    const codes = [l.code, ...parts];
    const lotLabel = `Lot ${codes.join(", ")}`;
    rows.push({
      key: l.code,
      codes,
      title: l.name ? `${l.name} (${lotLabel})` : lotLabel,
      spec: l.features ?? (l.size_m2 ? `${Math.round(l.size_m2).toLocaleString("en-US")} m²` : ""),
      usd: Number(l.price),
    });
  }
  // Named homes, estates and shares first, then the plain lots in number order (the order the live site uses).
  const named = (r: Row) => (lots.find((l) => l.code === r.key)?.name ? 0 : 1);
  return rows.sort((a, b) => named(a) - named(b) || Number(a.key) - Number(b.key));
}

export function LotExplorer({ lots, rates }: { lots: PublicLot[]; rates: Record<Currency, number> }) {
  const [cur, setCur] = useState<Currency>("USD");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = rowsFor(lots);
  const byCode = new Map(lots.map((l) => [l.code, l]));
  const money = (usd: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(usd * rates[cur]);

  // A lot that belongs to an estate selects the estate's row.
  const rowOf = (code: string) => rows.find((r) => r.codes.includes(code));
  const row = selected ? rowOf(selected) : undefined;
  const lot = row ? byCode.get(row.key) : undefined;

  return (
    <div className="explorer">
      <div className="explorer-top">
        <div className="filters" role="group" aria-label="Choose currency">
          <span className="eyebrow" style={{ alignSelf: "center", marginRight: 8 }}>Choose currency</span>
          {CURRENCIES.map((c) => (
            <button key={c} type="button" className="filter" aria-pressed={cur === c} onClick={() => setCur(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="explorer-body">
        <div className="lotmap" style={{ aspectRatio: `${MAP_SIZE.width} / ${MAP_SIZE.height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/estate-map.webp" alt="Site map of The ARK with every lot numbered" />
          {lots.map((l) => {
            const at = MAP_POINTS[l.code];
            if (!at) return null;
            const forSale = l.status === "available";
            const on = !!row && row.codes.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                className={`pin${forSale ? " free" : ""}${on ? " on" : ""}`}
                style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
                aria-pressed={on}
                aria-label={`Lot ${l.code}, ${forSale ? "available" : "sold"}`}
                disabled={!forSale}
                onClick={() => setSelected(on ? null : l.code)}
              >
                {l.code}
              </button>
            );
          })}
        </div>

        <aside className="lotside">
          {row && lot ? (
            <div className="card" style={{ padding: 28 }} aria-live="polite">
              <span className="eyebrow">Lot {row.codes.join(", ")}</span>
              <h3>{lot.name ?? "Estate details"}</h3>
              <dl className="facts">
                {lot.size_m2 && (
                  <>
                    <dt>Size</dt>
                    <dd>{Math.round(Number(lot.size_m2)).toLocaleString("en-US")} m²</dd>
                  </>
                )}
                <dt>Price</dt>
                <dd>{money(row.usd)} ({cur})</dd>
                {lot.features && (
                  <>
                    <dt>Setting</dt>
                    <dd>{lot.features}</dd>
                  </>
                )}
              </dl>
              <Link className="btn btn-primary" href="/apply-stewardship">Inquire about Lot {row.codes[0]}</Link>
            </div>
          ) : (
            <div className="card" style={{ padding: 28 }}>
              <h3>Select a lot marker</h3>
              <p>Select a lot marker to reveal live pricing and estate specifications.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="section-head" style={{ marginTop: 24 }}>
        <div>
          <h2>Available Lots Inventory</h2>
        </div>
        <p>Full inventory of available lots, estates &amp; fractional shares</p>
      </div>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Lot / Estate</th>
              <th>Specifications / Size</th>
              <th className="num">Live price ({cur})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                data-lot={r.key}
                className={row?.key === r.key ? "on" : undefined}
                onClick={() => setSelected(row?.key === r.key ? null : r.key)}
              >
                <td>{r.title}</td>
                <td>{r.spec}</td>
                <td className="num">{money(r.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
