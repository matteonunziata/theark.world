"use client";

import { useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { CATEGORIES, fmtMoney, lowState } from "@/lib/shop";
import { recordStock, saveProduct } from "./actions";

type Product = Tables<"products">;
type Move = { id: string; product_id: string; type: string; delta: number; created_at: string };

export function ShopView({
  products,
  moves,
  currency,
  canEdit,
}: {
  products: Product[];
  moves: Move[];
  currency: string;
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const drawer = useDrawer<Product>();
  const low = products.filter((p) => lowState(p));
  const value = products.reduce((n, p) => n + Number(p.stock) * Number(p.price), 0);
  const needle = q.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!needle || p.name.toLowerCase().includes(needle)) &&
      (!cat || p.category === cat) &&
      (!lowOnly || lowState(p)),
  );

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{products.length}</b><span>Products</span></div>
        <div className="stat"><b>{low.length}</b><span>Low or out of stock</span></div>
        <div className="stat"><b>{fmtMoney(value, currency)}</b><span>Stock at retail value</span></div>
      </div>
      {low.length > 0 && (
        <div className="alert" role="status">
          <b>{low.length === 1 ? "1 product needs" : `${low.length} products need`} restocking</b>
          <ul>
            {low.slice(0, 6).map((p) => (
              <li key={p.id}>
                {p.name}:{" "}
                {Number(p.stock) <= 0
                  ? "out of stock"
                  : `${Number(p.stock)} ${p.unit ?? ""} left, alert at ${Number(p.low_at)}`}
              </li>
            ))}
            {low.length > 6 && <li>and {low.length - 6} more</li>}
          </ul>
        </div>
      )}
      <div className="toolbar">
        <input className="field-in search" type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field-in" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
        {canEdit && (
          <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
            Add product
          </button>
        )}
      </div>
      {!products.length ? (
        <div className="empty">
          <h2>No products yet</h2>
          <p>
            Add what the farm shop sells: produce, eggs, pantry goods, drinks.
            Set a low-stock alert on each so nothing runs out quietly.
          </p>
          {canEdit && (
            <button type="button" className="btn primary" onClick={drawer.openNew}>
              Add the first product
            </button>
          )}
        </div>
      ) : !list.length ? (
        <div className="empty"><p>No products match.</p></div>
      ) : (
        <div className="list">
          <div className="row head srow">
            <span>Product</span>
            <span className="c-cat">Category</span>
            <span className="c-price">Price</span>
            <span>In stock</span>
            <span />
          </div>
          {list.map((p) => {
            const ls = lowState(p);
            return (
              <button type="button" className="row srow" key={p.id} onClick={() => drawer.openItem(p)}>
                <span className="who" style={{ display: "block" }}>
                  <b>{p.name}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{p.unit ? `per ${p.unit}` : ""}</span>
                </span>
                <span className="c-cat muted">{p.category}</span>
                <span className="c-price">
                  {fmtMoney(p.price, currency)}
                  {p.member_price !== null && (
                    <>
                      <br />
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        members {fmtMoney(p.member_price, currency)}
                      </span>
                    </>
                  )}
                </span>
                <span className={`stock ${ls}`}>
                  {Number(p.stock)} {p.unit ?? ""}
                  {ls === "out" ? " · out" : ls === "low" ? " · low" : ""}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>{canEdit ? "Edit" : "View"}</span>
              </button>
            );
          })}
        </div>
      )}
      <ProductDrawer
        key={drawer.item?.id ?? "new"}
        open={drawer.open}
        p={drawer.item}
        moves={moves.filter((m) => m.product_id === drawer.item?.id).slice(0, 8)}
        canEdit={canEdit}
        onClose={drawer.close}
      />
    </>
  );
}

function ProductDrawer({
  open,
  p,
  moves,
  canEdit,
  onClose,
}: {
  open: boolean;
  p: Product | null;
  moves: Move[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [qty, setQty] = useState("1");
  const [pending, start] = useTransition();
  const toast = useToast();
  const quick = (type: "sale" | "restock") =>
    start(async () => {
      const r = await recordStock(p!.id, type, Number(qty));
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
      if (r.ok) onClose();
    });

  return (
    <Drawer
      title={p ? (canEdit ? "Edit product" : p.name) : "Add product"}
      open={open}
      onClose={onClose}
      action={saveProduct}
      footer={
        canEdit && (
          <>
            {p && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {p ? "Save product" : "Add product"}
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        {p && <input type="hidden" name="id" value={p.id} />}
        <div className="fld">
          <label htmlFor="p-name">Product</label>
          <input id="p-name" name="name" defaultValue={p?.name} required placeholder="e.g. Cherry tomatoes" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="p-cat">Category</label>
            <select id="p-cat" name="category" defaultValue={p?.category ?? "Vegetables"}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="p-unit">Sold per</label>
            <input id="p-unit" name="unit" defaultValue={p?.unit ?? "kg"} placeholder="kg, bunch, dozen, jar" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="p-price">Price</label>
            <input id="p-price" name="price" type="number" min={0} step="any" defaultValue={p?.price ?? ""} required />
          </div>
          <div className="fld">
            <label htmlFor="p-mprice">Member price</label>
            <input id="p-mprice" name="member_price" type="number" min={0} step="any" defaultValue={p?.member_price ?? ""} placeholder="Same as price" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="p-stock">In stock now</label>
            <input id="p-stock" name="stock" type="number" min={0} step="any" defaultValue={p?.stock ?? 0} />
          </div>
          <div className="fld">
            <label htmlFor="p-low">Alert when at or below</label>
            <input id="p-low" name="low_at" type="number" min={0} step="any" defaultValue={p?.low_at ?? 5} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="p-desc">Notes</label>
          <textarea id="p-desc" name="description" defaultValue={p?.description ?? ""} placeholder="Supplier, harvest rhythm, anything the shop team should know" />
        </div>
      </fieldset>
      {p && (
        <>
          {canEdit && (
            <>
              <div className="subhead">Quick stock change</div>
              <div className="grid2" style={{ alignItems: "end" }}>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label htmlFor="q-amt">Quantity</label>
                  <input id="q-amt" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="adj">
                  <button type="button" className="btn" disabled={pending} onClick={() => quick("sale")}>
                    Record a sale
                  </button>
                  <button type="button" className="btn" disabled={pending} onClick={() => quick("restock")}>
                    Restock
                  </button>
                </div>
              </div>
            </>
          )}
          <div className="subhead">Recent changes</div>
          <div className="ledger">
            {moves.length ? (
              moves.map((m) => (
                <div className="n" key={m.id}>
                  <span>
                    {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {m.type}
                  </span>
                  <b>
                    {m.delta > 0 ? "+" : ""}
                    {Number(m.delta)}
                  </b>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: 0 }}>No changes recorded.</p>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
