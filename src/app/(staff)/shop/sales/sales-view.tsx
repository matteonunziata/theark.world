"use client";

import { useMemo, useState } from "react";
import { Drawer } from "@/components/drawer";
import { type Person, PersonPicker } from "@/components/person-picker";
<<<<<<< HEAD
import { RangePicker, recentPresets } from "@/components/range-picker";
=======
import { RangePicker } from "@/components/range-picker";
import { recentPresets } from "@/lib/range-presets";
>>>>>>> origin/main
import { fmtMoney, SHOP_METHODS, shopMethodName } from "@/lib/shop";
import { fmtWhen } from "@/lib/shop-report";
import { recordDelivery, recordSale } from "../actions";

type Move = {
  id: string;
  type: string;
  delta: number;
  amount: number | null;
  unit_price: number | null;
  method: string | null;
  order_id: string | null;
  contact_id: string | null;
  created_at: string;
  product: { name: string; unit: string | null; category: string } | null;
  contact: { name: string } | null;
  by: { name: string } | null;
};
type Product = {
  id: string;
  name: string;
  price: number;
  member_price: number | null;
  stock: number;
  track_stock: boolean;
  unit: string | null;
  category: string;
  online: boolean | null;
};
type Entry = {
  id: string;
  type: string;
  at: string;
  lines: Move[];
  amount: number;
  units: number;
  buyer: string | null;
  linked: boolean;
  method: string | null;
  by: string | null;
};

const KINDS = [
  ["", "Everything"],
  ["sale", "Sales"],
  ["restock", "Deliveries"],
  ["adjusted", "Adjustments"],
] as const;

const typeName = (t: string) => (t === "sale" ? "Sale" : t === "restock" ? "Delivery" : "Adjustment");
const qty = (n: number) => String(Math.abs(Number(n))).replace(/\.0+$/, "");

/** Lines sold (or delivered) together become one entry; older rows stand alone. */
function group(moves: Move[]): Entry[] {
  const by = new Map<string, Entry>();
  for (const m of moves) {
    const key = m.order_id ? `${m.type}:${m.order_id}` : m.id;
    let e = by.get(key);
    if (!e) {
      e = {
        id: key,
        type: m.type,
        at: m.created_at,
        lines: [],
        amount: 0,
        units: 0,
        buyer: m.contact?.name ?? null,
        linked: !!m.contact_id,
        method: m.method,
        by: m.by?.name ?? null,
      };
      by.set(key, e);
    }
    e.lines.push(m);
    e.amount += Number(m.amount ?? 0);
    e.units += Math.abs(Number(m.delta));
    if (m.created_at > e.at) e.at = m.created_at;
  }
  return [...by.values()];
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function SalesView({
  moves,
  products,
  currency,
  canEdit,
  from,
  to,
  today,
  capped,
}: {
  moves: Move[];
  products: Product[];
  currency: string;
  canEdit: boolean;
  from: string;
  to: string;
  today: string;
  capped: boolean;
}) {
  const [kind, setKind] = useState<string>("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"sale" | "delivery" | null>(null);
  const [tillKey, setTillKey] = useState(0);
  const money = (n: number) => fmtMoney(n, currency);

  const entries = useMemo(() => group(moves), [moves]);
  const needle = q.trim().toLowerCase();
  const shown = entries.filter(
    (e) =>
      (!kind || e.type === kind) &&
      (!needle ||
        e.lines.some((l) => l.product?.name.toLowerCase().includes(needle)) ||
        e.buyer?.toLowerCase().includes(needle) ||
        e.by?.toLowerCase().includes(needle)),
  );
  const sales = shown.filter((e) => e.type === "sale");
  const total = sales.reduce((n, e) => n + e.amount, 0);
  const units = sales.reduce((n, e) => n + e.units, 0);

  const exportCsv = () => {
    const head = ["Date", "Time", "Type", "Product", "Quantity", "Unit price", "Amount", "Paid by", "Sold to", "Recorded by", "Order"];
    const rows = shown.flatMap((e) =>
      e.lines.map((l) => {
        const [date, time] = fmtWhen(l.created_at).split(", ");
        return [
          date,
          time,
          typeName(l.type),
          l.product?.name ?? "",
          (l.type === "sale" ? "-" : "") + qty(l.delta),
          l.unit_price ?? "",
          l.amount ?? "",
          l.type === "sale" ? shopMethodName(l.method) : "",
          l.contact?.name ?? "",
          l.by?.name ?? "",
          l.order_id ?? l.id,
        ];
      }),
    );
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `farm-shop-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setDrawer(null);
    setTillKey((k) => k + 1);
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <RangePicker from={from} to={to} today={today} presets={recentPresets(today)} />
        {canEdit && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => setDrawer("delivery")}>
              Delivery
            </button>
            <button type="button" className="btn primary" onClick={() => setDrawer("sale")}>
              Record a sale
            </button>
          </span>
        )}
      </div>
      <div className="toolbar">
        <div className="pill-row" role="group" aria-label="Kind" style={{ margin: 0 }}>
          {KINDS.map(([k, n]) => (
            <button key={k} type="button" className="pill" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {n}
            </button>
          ))}
        </div>
        <input
          className="field-in search"
          type="search"
          placeholder="Search products or people"
          aria-label="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn ghost" onClick={exportCsv} disabled={!shown.length}>
          Export CSV
        </button>
      </div>
      <p className="ledger-sum">
        <span>
          <b>{sales.length}</b> sale{sales.length === 1 ? "" : "s"}
        </span>
        <span>
          <b>{money(total)}</b> taken
        </span>
        <span>
          <b>{units}</b> item{units === 1 ? "" : "s"}
        </span>
        {shown.length !== sales.length && (
          <span>
            <b>{shown.length - sales.length}</b> deliver{shown.length - sales.length === 1 ? "y" : "ies"} and adjustments
          </span>
        )}
        {capped && <span>Showing the latest 1,000 lines. Narrow the range to see everything.</span>}
      </p>

      {!entries.length ? (
        <div className="empty">
          <h2>Nothing recorded in this range</h2>
          <p>
            Record a sale here as it happens: pick the products, say how it was paid, and
            who bought it if you know. Stock and the Overview follow.
          </p>
          {canEdit && (
            <button type="button" className="btn primary" onClick={() => setDrawer("sale")}>
              Record a sale
            </button>
          )}
        </div>
      ) : !shown.length ? (
        <div className="empty">
          <p>Nothing matches.</p>
        </div>
      ) : (
        <div className="list">
          <div className="row head lrow">
            <span>When</span>
            <span>What</span>
            <span>Who</span>
            <span>Paid</span>
            <span style={{ textAlign: "right" }}>Amount</span>
          </div>
          {shown.map((e) => {
            const isOpen = open === e.id;
            const summary = e.lines
              .map((l) => `${l.product?.name ?? "Product"}${Math.abs(l.delta) !== 1 ? ` × ${qty(l.delta)}` : ""}`)
              .join(", ");
            return (
              <button
                type="button"
                className="row lrow"
                key={e.id}
                onClick={() => setOpen(isOpen ? null : e.id)}
                aria-expanded={isOpen}
              >
                <span>
                  {fmtWhen(e.at)}
                  {e.type !== "sale" && (
                    <span className="tag-sm" style={{ display: "block", width: "fit-content", margin: "4px 0 0" }}>
                      {typeName(e.type)}
                    </span>
                  )}
                </span>
                <span className="sum">
                  <b title={summary}>{summary}</b>
                  {isOpen && (
                    <ul className="lines">
                      {e.lines.map((l) => (
                        <li key={l.id}>
                          {l.type === "sale" ? "−" : "+"}
                          {qty(l.delta)} {l.product?.unit ?? ""} {l.product?.name}
                          {l.type === "sale" && l.unit_price != null && ` at ${money(Number(l.unit_price))}`}
                          {l.type === "sale" && l.amount != null && ` = ${money(Number(l.amount))}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
                <span className="meta">
                  {e.type === "sale" ? (e.buyer ?? (e.linked ? "A contact" : "Walk-in")) : ""}
                  {e.by && (
                    <>
                      {e.type === "sale" ? <br /> : null}
                      by {e.by}
                    </>
                  )}
                </span>
                <span className="meta">{e.type === "sale" ? shopMethodName(e.method) : ""}</span>
                <span className={`amt ${e.type === "restock" ? "in" : ""}`}>
                  {e.type === "sale" ? money(e.amount) : `${e.type === "restock" ? "+" : ""}${e.units} item${e.units === 1 ? "" : "s"}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <TillDrawer key={`sale-${tillKey}`} open={drawer === "sale"} products={products} currency={currency} onClose={close} />
      <DeliveryDrawer key={`delivery-${tillKey}`} open={drawer === "delivery"} products={products} onClose={close} />
    </>
  );
}

type Line = { product: Product; qty: number };

/** Search the catalog and build up lines with quantities. */
function LinePicker({
  products,
  lines,
  setLines,
  currency,
  withPrice,
}: {
  products: Product[];
  lines: Line[];
  setLines: (l: Line[]) => void;
  currency: string;
  withPrice: boolean;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? products
        .filter((p) => p.name.toLowerCase().includes(needle) && !lines.some((l) => l.product.id === p.id))
        .slice(0, 8)
    : [];
  const add = (p: Product) => {
    setLines([...lines, { product: p, qty: 1 }]);
    setQ("");
  };
  const setQty = (id: string, n: number) =>
    setLines(lines.map((l) => (l.product.id === id ? { ...l, qty: n } : l)));
  const remove = (id: string) => setLines(lines.filter((l) => l.product.id !== id));

  return (
    <>
      <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ product_id: l.product.id, qty: l.qty })))} />
      <div className="fld till-search">
        <label htmlFor="till-q">Add a product</label>
        <input
          id="till-q"
          type="search"
          placeholder="Start typing: eggs, kale, cold brew"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (hits[0]) add(hits[0]);
            }
          }}
          autoComplete="off"
        />
        {needle && (
          <ul className="till-hits">
            {hits.length ? (
              hits.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)}>
                    <span>{p.name}</span>
                    <span className="muted">
                      {withPrice ? fmtMoney(p.price, currency) : ""}
                      {p.track_stock ? ` · ${qty(p.stock)} in stock` : ""}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li>
                <span className="muted" style={{ display: "block", padding: "8px 12px", fontSize: 13.5 }}>
                  No product called “{q.trim()}”.
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
      {lines.length > 0 && (
        <div className="till-lines">
          {lines.map((l) => (
            <div className={`till-line ${withPrice ? "" : "plain"}`} key={l.product.id}>
              <span className="nm">
                {l.product.name}
                <small>
                  {withPrice ? fmtMoney(l.product.price, currency) : ""}
                  {l.product.unit ? ` per ${l.product.unit}` : ""}
                  {l.product.track_stock ? ` · ${qty(l.product.stock)} in stock` : ""}
                </small>
              </span>
              <input
                type="number"
                min={0}
                step="any"
                aria-label={`Quantity of ${l.product.name}`}
                value={l.qty}
                onChange={(e) => setQty(l.product.id, Number(e.target.value))}
              />
              {withPrice && <span className="sub">{fmtMoney(l.qty * Number(l.product.price), currency)}</span>}
              <button type="button" className="x" aria-label={`Remove ${l.product.name}`} onClick={() => remove(l.product.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TillDrawer({
  open,
  products,
  currency,
  onClose,
}: {
  open: boolean;
  products: Product[];
  currency: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [buyer, setBuyer] = useState<Person | null>(null);
  const total = lines.reduce((n, l) => n + l.qty * Number(l.product.price), 0);
  const hasMemberPrice = lines.some((l) => l.product.member_price != null);
  return (
    <Drawer
      title="Record a sale"
      open={open}
      onClose={onClose}
      action={recordSale}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!lines.length}>
            Record {total ? fmtMoney(total, currency) : "sale"}
          </button>
        </>
      }
    >
      <LinePicker products={products} lines={lines} setLines={setLines} currency={currency} withPrice />
      <div className="till-total">
        <span>Total</span>
        <span>{fmtMoney(total, currency)}</span>
      </div>
      <div className="fld">
        <span className="lbl">Paid by</span>
        <div className="method-pills" role="radiogroup" aria-label="Paid by">
          {SHOP_METHODS.map(([k, n]) => (
            <label key={k}>
              <input type="radio" name="method" value={k} defaultChecked={k === "cash"} />
              {n}
            </label>
          ))}
        </div>
      </div>
      <PersonPicker
        name="contact_id"
        label="Sold to (optional)"
        hint={
          hasMemberPrice && buyer
            ? "Active members pay the member price where a product has one; the total above is at regular prices."
            : "Pick a member or contact and the sale shows on their CRM profile."
        }
        onChange={setBuyer}
      />
    </Drawer>
  );
}

function DeliveryDrawer({ open, products, onClose }: { open: boolean; products: Product[]; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  return (
    <Drawer
      title="Delivery"
      open={open}
      onClose={onClose}
      action={recordDelivery}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!lines.length}>
            Add to stock
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13.5 }}>
        What came in. Each product’s count goes up by the quantity, and products not yet counted
        start counting from the product drawer.
      </p>
      <LinePicker products={products} lines={lines} setLines={setLines} currency="" withPrice={false} />
    </Drawer>
  );
}
