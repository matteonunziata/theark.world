"use client";

import { type Person, PersonPicker } from "@/components/person-picker";
import { useState, useTransition } from "react";
import { CoverField } from "@/components/cover-field";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { CATEGORIES, fmtMoney, lowState, productImage, SHOP_METHODS } from "@/lib/shop";
import { recordStock, saveProduct, syncFromWebsite } from "../actions";

type Product = Tables<"products">;
type Move = { id: string; product_id: string; type: string; delta: number; created_at: string };

export function ShopView({
  products,
  moves,
  currency,
  canEdit,
  initialLow = false,
}: {
  products: Product[];
  moves: Move[];
  currency: string;
  canEdit: boolean;
  initialLow?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [lowOnly, setLowOnly] = useState(initialLow);
  const drawer = useDrawer<Product>();
  const [syncing, startSync] = useTransition();
  const toast = useToast();
  const sync = () =>
    startSync(async () => {
      const r = await syncFromWebsite();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });
  const low = products.filter((p) => lowState(p));
  const counted = products.filter((p) => p.track_stock);
  const value = counted.reduce((n, p) => n + Number(p.stock) * Number(p.price), 0);
  const categories = [
    ...CATEGORIES,
    ...new Set(products.map((p) => p.category).filter((c) => !CATEGORIES.includes(c))),
  ];
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
        <div className="stat"><b>{products.filter((p) => p.online).length}</b><span>Available online</span></div>
        <div className="stat"><b>{low.length}</b><span>Low or out of stock</span></div>
        <div className="stat"><b>{fmtMoney(value, currency)}</b><span>Counted stock at retail</span></div>
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
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
        {canEdit && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={sync} disabled={syncing} title="Pull new products and prices from thearkfarm.shop">
              {syncing ? "Syncing…" : "Sync from website"}
            </button>
            <button type="button" className="btn primary" onClick={drawer.openNew}>
              Add product
            </button>
          </span>
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
                <span className="who prod">
                  {productImage(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImage(p)!} alt="" loading="lazy" />
                  ) : (
                    <span className="ph" aria-hidden="true" />
                  )}
                  <span>
                    <b>{p.product_group ?? p.name}</b>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {[p.variant, p.unit ? `per ${p.unit}` : null].filter(Boolean).join(" · ")}
                      {p.online === false && <span className="tag-sm out" style={{ marginLeft: 8 }}>sold out online</span>}
                    </span>
                  </span>
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
                  {p.track_stock ? (
                    <>
                      {Number(p.stock)} {p.unit ?? ""}
                      {ls === "out" ? " · out" : ls === "low" ? " · low" : ""}
                    </>
                  ) : (
                    <span className="muted">Not counted</span>
                  )}
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
  const [buyer, setBuyer] = useState<Person | null>(null);
  const [method, setMethod] = useState<string>("cash");
  const [track, setTrack] = useState(p?.track_stock ?? true);
  const [pending, start] = useTransition();
  const toast = useToast();
  const quick = (type: "sale" | "restock") =>
    start(async () => {
      const r = await recordStock(p!.id, type, Number(qty), type === "sale" ? buyer?.id : null, method);
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
          <span className="lbl">Photo</span>
          <CoverField
            name="image_path"
            bucket="products"
            initial={p?.image_path}
            initialUrl={p?.image_url}
            keepName="image_url_keep"
          />
        </div>
        <div className="fld">
          <label htmlFor="p-name">Product</label>
          <input id="p-name" name="name" defaultValue={p?.name} required placeholder="e.g. Cherry tomatoes" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="p-cat">Category</label>
            <select id="p-cat" name="category" defaultValue={p?.category ?? "Fruit & vegetables"}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="p-unit">Sold per</label>
            <input id="p-unit" name="unit" defaultValue={p?.unit ?? ""} placeholder="kg, bunch, jar, bottle" />
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
        <label className="check" style={{ marginBottom: 12 }}>
          <input type="checkbox" name="track_stock" checked={track} onChange={(e) => setTrack(e.target.checked)} />
          Count stock for this product
        </label>
        <div className="grid2" hidden={!track}>
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
          <label htmlFor="p-desc">Description</label>
          <textarea id="p-desc" name="description" defaultValue={p?.description ?? ""} placeholder="What it is, how it’s made, anything the shop team should know" />
        </div>
        {p?.web_url && (
          <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
            On the online shop:{" "}
            <a href={p.web_url} target="_blank" rel="noreferrer">
              {p.web_url.replace("https://", "")}
            </a>
            {p.online === false && " (sold out there)"}
          </p>
        )}
      </fieldset>
      {p && (
        <>
          {canEdit && p.track_stock && (
            <>
              <div className="subhead">Quick stock change</div>
              <div className="grid2">
                <div className="fld">
                  <label htmlFor="q-amt">Quantity</label>
                  <input id="q-amt" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="fld">
                  <label htmlFor="q-method">Paid by</label>
                  <select id="q-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {SHOP_METHODS.map(([k, n]) => (
                      <option key={k} value={k}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="adj">
                <button type="button" className="btn" disabled={pending} onClick={() => quick("sale")}>
                  Record a sale
                </button>
                <button type="button" className="btn" disabled={pending} onClick={() => quick("restock")}>
                  Restock
                </button>
                <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
                  Several products at once: use the Sales tab.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <PersonPicker
                  name="sold_to"
                  label="Sold to (optional)"
                  hint="Pick a member or contact and the sale shows on their CRM profile, at member price for active members."
                  onChange={setBuyer}
                />
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
