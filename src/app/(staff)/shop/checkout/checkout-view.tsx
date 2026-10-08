"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { tierName } from "@/lib/crm";
import { avatarUrl } from "@/lib/covers";
import { CATEGORIES, fmtMoney, productImage } from "@/lib/shop";
import {
  type Customer,
  completeSale,
  emailReceipt,
  type Method,
  type Receipt,
  searchCustomers,
} from "./actions";

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  price: number;
  stock: number;
  track_stock: boolean;
  image_path: string | null;
  image_url: string | null;
};

const METHODS: [Method, string][] = [
  ["tilopay_account", "Pay with account"],
  ["bac_card", "Credit card (BAC)"],
  ["sinpe", "SINPE"],
  ["cash", "Cash"],
];

/** How many of a product can go in the basket. Uncounted products have no limit. */
const maxQty = (p: Product) => (p.track_stock ? p.stock : 999);
const soldOut = (p: Product) => p.track_stock && p.stock <= 0;

export function CheckoutView({
  products,
  sinpe,
  tilopay,
}: {
  products: Product[];
  sinpe: string | null;
  tilopay: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [methodPick, setMethod] = useState<Method | null>(null);
  const [ref, setRef] = useState("");
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, start] = useTransition();
  // The sale being finished, kept for the receipt after the basket clears.
  const [done, setDone] = useState<{ customer: Customer | null; method: Method } | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const cats = useMemo(() => CATEGORIES.filter((c) => products.some((p) => p.category === c)), [products]);
  const shown = products.filter(
    (p) => (!cat || p.category === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const pct = customer?.discount_percent ?? 0;
  const lines = Object.entries(basket)
    .map(([id, qty]) => ({ p: byId.get(id)!, qty }))
    .filter((l) => l.p && l.qty > 0);
  const subtotal = lines.reduce((n, l) => n + Math.round(l.p.price * l.qty), 0);
  const discount = lines.reduce((n, l) => n + Math.round((Math.round(l.p.price * l.qty) * pct) / 100), 0);
  const total = subtotal - discount;

  const methods = METHODS.filter(([m]) => m !== "tilopay_account" || (tilopay && customer?.has_card));
  // A method that is no longer offered (customer removed or changed) counts as none.
  const method = methods.some(([m]) => m === methodPick) ? methodPick : null;

  const add = (p: Product) => {
    if (soldOut(p)) return;
    setBasket((b) => ({ ...b, [p.id]: Math.min(maxQty(p), (b[p.id] ?? 0) + 1) }));
    setError(null);
  };
  const setQty = (p: Product, n: number) =>
    setBasket((b) => {
      const next = { ...b };
      if (n <= 0) delete next[p.id];
      else next[p.id] = Math.min(maxQty(p), n);
      return next;
    });

  const cashNum = Number(cash);
  const change = cashNum - total;
  const ready =
    lines.length > 0 &&
    method !== null &&
    (method === "cash" ? cash !== "" && change >= 0 : method === "tilopay_account" ? true : ref.trim() !== "");

  const reset = () => {
    setBasket({});
    setCustomer(null);
    setMethod(null);
    setRef("");
    setCash("");
    setError(null);
    setReceipt(null);
    setDone(null);
  };

  const confirm = () => {
    if (!method || !ready) return;
    setError(null);
    start(async () => {
      const res = await completeSale({
        contactId: customer?.id ?? null,
        lines: lines.map((l) => ({ product_id: l.p.id, qty: l.qty })),
        method,
        reference: ref,
        cashReceived: method === "cash" ? cashNum : undefined,
      });
      if (!res.ok) return setError(res.error);
      setDone({ customer, method });
      setReceipt(res.receipt);
    });
  };

  if (receipt && done) {
    return <Confirmation receipt={receipt} customer={done.customer} method={done.method} onNext={reset} />;
  }

  return (
    <div className="co">
      <section className="co-products" aria-label="Products">
        <div className="co-tools">
          <input
            className="co-search"
            type="search"
            placeholder="Search products"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search products"
          />
          <div className="co-cats" role="tablist" aria-label="Category">
            {["", ...cats].map((c) => (
              <button key={c || "all"} type="button" className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
                {c || "All"}
              </button>
            ))}
          </div>
        </div>
        <div className="co-grid">
          {shown.map((p) => {
            const img = productImage(p);
            const out = soldOut(p);
            return (
              <button
                key={p.id}
                type="button"
                className={`co-card${out ? " out" : ""}`}
                disabled={out}
                onClick={() => add(p)}
              >
                <span className="co-photo">
                  {/* biome-ignore lint/performance/noImgElement: remote catalog photos */}
                  {img ? <img src={img} alt="" loading="lazy" /> : <span>{p.name.slice(0, 1)}</span>}
                </span>
                <span className="co-name">{p.name}</span>
                <span className="co-price">{fmtMoney(p.price)}</span>
                <span className="co-stock">
                  {out ? "Out of stock" : p.track_stock ? `${p.stock} in stock` : "Stock not counted"}
                </span>
                {basket[p.id] ? <span className="co-badge">{basket[p.id]}</span> : null}
              </button>
            );
          })}
          {!shown.length && <p className="muted">No products match.</p>}
        </div>
      </section>

      <aside className="co-side">
        <CustomerPanel customer={customer} onPick={setCustomer} />

        <section className="co-box">
          <h3>Basket</h3>
          {lines.length === 0 ? (
            <p className="muted">Tap a product to add it.</p>
          ) : (
            <ul className="co-lines">
              {lines.map(({ p, qty }) => (
                <li key={p.id}>
                  <div className="co-lname">
                    <b>{p.name}</b>
                    <span>{fmtMoney(Math.round(p.price * qty))}</span>
                  </div>
                  <div className="co-qty">
                    <button type="button" aria-label={`Fewer ${p.name}`} onClick={() => setQty(p, qty - 1)}>
                      −
                    </button>
                    <output>{qty}</output>
                    <button
                      type="button"
                      aria-label={`More ${p.name}`}
                      disabled={qty >= maxQty(p)}
                      onClick={() => setQty(p, qty + 1)}
                    >
                      +
                    </button>
                    <button type="button" className="rm" aria-label={`Remove ${p.name}`} onClick={() => setQty(p, 0)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <dl className="co-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{fmtMoney(subtotal)}</dd>
            </div>
            {pct > 0 && (
              <div>
                <dt>Member discount ({pct}%)</dt>
                <dd>−{fmtMoney(discount)}</dd>
              </div>
            )}
            <div className="grand">
              <dt>Total</dt>
              <dd>{fmtMoney(total)}</dd>
            </div>
          </dl>
        </section>

        {lines.length > 0 && (
          <section className="co-box">
            <h3>Payment</h3>
            <div className="co-methods">
              {methods.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={method === m ? "on" : ""}
                  onClick={() => {
                    setMethod(m);
                    setError(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {method === "tilopay_account" && (
              <p className="co-note">
                {customer?.name}’s saved card will be charged {fmtMoney(total)}.
              </p>
            )}
            {method === "bac_card" && (
              <>
                <p className="co-note">Type this amount into the BAC reader:</p>
                <div className="co-big">{fmtMoney(total)}</div>
                <div className="fld">
                  <label htmlFor="co-auth">Authorization code from the receipt</label>
                  <input id="co-auth" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />
                </div>
              </>
            )}
            {method === "sinpe" && (
              <>
                <p className="co-note">
                  {sinpe ? (
                    <>
                      SINPE Móvil to <b className="co-num">{sinpe}</b>
                    </>
                  ) : (
                    "No SINPE number is set. An admin can add it in Settings → Organization."
                  )}
                </p>
                <div className="co-big">{fmtMoney(total)}</div>
                <div className="fld">
                  <label htmlFor="co-sinpe">SINPE reference number</label>
                  <input
                    id="co-sinpe"
                    inputMode="numeric"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {method === "cash" && (
              <>
                <div className="fld">
                  <label htmlFor="co-cash">Cash received (₡)</label>
                  <input
                    id="co-cash"
                    inputMode="numeric"
                    value={cash}
                    onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </div>
                <div className="co-quick">
                  <button type="button" onClick={() => setCash(String(total))}>
                    Exact
                  </button>
                  {[5000, 10000, 20000, 50000]
                    .filter((n) => n >= total)
                    .slice(0, 3)
                    .map((n) => (
                      <button key={n} type="button" onClick={() => setCash(String(n))}>
                        {fmtMoney(n)}
                      </button>
                    ))}
                </div>
                {cash !== "" && (
                  <div className={`co-change${change < 0 ? " short" : ""}`}>
                    {change < 0 ? `Short by ${fmtMoney(-change)}` : `Change due ${fmtMoney(change)}`}
                  </div>
                )}
              </>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
            <button type="button" className="btn primary co-pay" disabled={!ready || pending} onClick={confirm}>
              {pending ? "Working…" : `Confirm ${fmtMoney(total)}`}
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}

function CustomerPanel({ customer, onPick }: { customer: Customer | null; onPick: (c: Customer | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchCustomers(term);
      if (mine === seq.current) {
        setResults(r);
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (customer) {
    const photo = avatarUrl(customer.photo_path);
    return (
      <section className="co-box">
        <h3>Customer</h3>
        <div className="co-cust">
          <span className="co-av">
            {/* biome-ignore lint/performance/noImgElement: member photo */}
            {photo ? <img src={photo} alt="" /> : customer.name.slice(0, 1)}
          </span>
          <div>
            <b>{customer.name}</b>
            <div className="muted">
              {customer.tier
                ? `${tierName(customer.tier)}${customer.membership_status ? ` · ${customer.membership_status}` : ""}`
                : "Not a member"}
              {customer.discount_percent > 0 ? ` · ${customer.discount_percent}% off` : ""}
            </div>
            <div className="muted">{customer.has_card ? "Card on file" : "No card on file"}</div>
          </div>
          <button type="button" className="btn" onClick={() => onPick(null)}>
            Change
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="co-box">
      <h3>Customer <span className="muted">(optional)</span></h3>
      <input
        className="co-search"
        type="search"
        placeholder="Name, phone or email — or skip for a guest sale"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setBusy(e.target.value.trim().length >= 2);
        }}
        aria-label="Search customers"
      />
      {busy && <p className="muted">Searching…</p>}
      <ul className="co-results">
        {(q.trim().length >= 2 ? results : []).map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                onPick(c);
                setQ("");
                setResults([]);
              }}
            >
              <b>{c.name}</b>
              <span className="muted">
                {c.email ?? c.phone ?? ""}
                {c.tier ? ` · ${tierName(c.tier)}` : ""}
              </span>
            </button>
          </li>
        ))}
        {!busy && q.trim().length >= 2 && results.length === 0 && <li className="muted">No one found.</li>}
      </ul>
      <p className="muted co-guest">Guest sale: no discount, no account payment.</p>
    </section>
  );
}

function Confirmation({
  receipt,
  customer,
  method,
  onNext,
}: {
  receipt: Receipt;
  customer: Customer | null;
  method: Method;
  onNext: () => void;
}) {
  const toast = useToast();
  const [sending, start] = useTransition();
  const label = METHODS.find(([m]) => m === method)?.[1] ?? method;
  const digits = customer?.phone?.replace(/\D/g, "") ?? "";
  const wa = digits
    ? `https://wa.me/${digits.length === 8 ? `506${digits}` : digits}?text=${encodeURIComponent(
        `Thank you for shopping at The ARK farm shop. Your total was ${fmtMoney(receipt.total)}${
          receipt.discount > 0 ? ` (includes ${receipt.discount_percent}% member discount)` : ""
        }.`,
      )}`
    : null;
  return (
    <div className="co-done">
      <div className="co-tick" aria-hidden="true">✓</div>
      <h2>Sale complete</h2>
      <div className="co-big">{fmtMoney(receipt.total)}</div>
      <p className="muted">
        {label}
        {customer ? ` · ${customer.name}` : " · Guest"}
      </p>
      {receipt.change_due != null && receipt.change_due > 0 && (
        <div className="co-change">Change due {fmtMoney(receipt.change_due)}</div>
      )}
      {customer && (
        <div className="co-actions">
          {customer.email && (
            <button
              type="button"
              className="btn"
              disabled={sending}
              onClick={() =>
                start(async () => {
                  const r = await emailReceipt(receipt.sale_id, customer.email);
                  toast(r.message);
                })
              }
            >
              Email receipt
            </button>
          )}
          {wa && (
            <a className="btn" href={wa} target="_blank" rel="noreferrer">
              WhatsApp receipt
            </a>
          )}
        </div>
      )}
      <button type="button" className="btn primary co-pay" onClick={onNext}>
        Next customer
      </button>
    </div>
  );
}
