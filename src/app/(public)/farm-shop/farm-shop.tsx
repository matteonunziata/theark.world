"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { type CartLine, basketTotals, cleanCart, MAX_QTY, memberPrice } from "@/lib/shop-cart";
import { fly } from "@/lib/shop-fly";
import { startPublicShopCheckout } from "./actions";

export type Group = {
  key: string;
  name: string;
  category: string;
  image: string | null;
  description: string | null;
  options: { id: string; label: string | null; price: number }[];
};

const KEY = "ark-shop-cart"; // the same basket as the members portal, in this browser
const crc = (n: number) => `₡${n.toLocaleString("en-US")}`;
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function FarmShop({
  groups,
  percent,
  member,
  payReady,
  shopUrl,
  justPaid,
}: {
  groups: Group[];
  percent: number;
  member: { name: string; email: string } | null;
  payReady: boolean;
  shopUrl: string;
  justPaid: boolean;
}) {
  const toast = useToast();
  const [paying, startPay] = useTransition();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [bump, setBump] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const basketRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved basket can only be read after hydration
      setCart(justPaid ? [] : cleanCart(JSON.parse(localStorage.getItem(KEY) ?? "[]")));
    } catch {}
    setReady(true);
  }, [justPaid]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, ready]);

  const byId = useMemo(() => {
    const m = new Map<string, { g: Group; label: string | null; price: number }>();
    for (const g of groups) for (const o of g.options) m.set(o.id, { g, label: o.label, price: o.price });
    return m;
  }, [groups]);
  const cats = useMemo(() => [...new Set(groups.map((g) => g.category))], [groups]);
  const shown = groups.filter(
    (g) => (!cat || g.category === cat) && (!q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const lines = cart.flatMap((l) => {
    const it = byId.get(l.id);
    return it ? [{ ...l, ...it }] : [];
  });
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const { subtotal, discount, total } = basketTotals(lines, percent);
  const wouldSave = basketTotals(lines, 10).discount;

  const pay = () =>
    startPay(async () => {
      const r = await startPublicShopCheckout(lines.map((l) => ({ id: l.id, qty: l.qty })), { name, email });
      if (r.ok && r.url) window.location.assign(r.url);
      else toast(r.error ?? "Couldn’t start your order.");
    });

  const add = (id: string, by = 1) =>
    setCart((c) => {
      const have = c.find((l) => l.id === id);
      const qty = Math.min(MAX_QTY, (have?.qty ?? 0) + by);
      if (qty < 1) return c.filter((l) => l.id !== id);
      return have ? c.map((l) => (l.id === id ? { ...l, qty } : l)) : [...c, { id, qty }];
    });

  const addFromCard = (e: MouseEvent<HTMLButtonElement>, g: Group, id: string) => {
    const card = e.currentTarget.closest(".fs-card");
    const from = card?.querySelector(".fs-img") ?? e.currentTarget;
    add(id);
    setAdded((a) => ({ ...a, [g.key]: true }));
    window.setTimeout(() => setAdded((a) => ({ ...a, [g.key]: false })), 1400);
    if (calm()) return setBump((n) => n + 1);
    requestAnimationFrame(() => {
      const to = basketRef.current;
      if (!to) return setBump((n) => n + 1);
      void fly(from, to, g.image, "fs-fly").then(() => setBump((n) => n + 1));
    });
  };

  return (
    <>
      {justPaid && <p className="fs-ok" role="status">Thank you. Your order is paid. Pick it up at The ARK.</p>}
      <div className="fs-bar">
        <input className="fs-search" type="search" placeholder="Search the shop" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the shop" />
        <button type="button" className="btn sm" onClick={() => setOpen(true)} aria-label={`Basket, ${count} items`}>
          Basket{count ? ` (${count})` : ""}
        </button>
      </div>
      <div className="fs-pills" role="group" aria-label="Category">
        <button type="button" className="fs-pill" aria-current={!cat ? "page" : undefined} onClick={() => setCat("")}>Everything</button>
        {cats.map((c) => (
          <button key={c} type="button" className="fs-pill" aria-current={cat === c ? "page" : undefined} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="fs-empty">{groups.length ? "Nothing matches that." : "The shop is empty right now. Check back soon."}</p>
      ) : (
        <div className="fs-grid">
          {shown.map((g) => {
            const id = picked[g.key] ?? g.options[0].id;
            const o = g.options.find((x) => x.id === id) ?? g.options[0];
            const mp = memberPrice(o.price, percent);
            return (
              <article key={g.key} className="fs-card">
                <div className="fs-img" style={g.image ? { backgroundImage: `url(${g.image})` } : undefined} role="img" aria-label={g.name} />
                <div className="body">
                  <h3>{g.name}</h3>
                  <div className="sub">{g.category}</div>
                  {g.options.length > 1 && (
                    <select className="fs-opt" aria-label={`Option for ${g.name}`} value={o.id} onChange={(e) => setPicked((p) => ({ ...p, [g.key]: e.target.value }))}>
                      {g.options.map((x) => (
                        <option key={x.id} value={x.id}>{x.label} · {crc(memberPrice(x.price, percent))}</option>
                      ))}
                    </select>
                  )}
                  <div className="foot">
                    <span className="price">
                      <b>{crc(mp)}</b>
                      {mp !== o.price && <s>{crc(o.price)}</s>}
                    </span>
                    <button type="button" className={`btn sm solid fs-add${added[g.key] ? " done" : ""}`} onClick={(e) => addFromCard(e, g, o.id)}>
                      {added[g.key] ? "Added" : "Add"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {count > 0 && !open && (
        <button ref={basketRef} type="button" key={bump} className={`fs-float${bump ? " bump" : ""}`} onClick={() => setOpen(true)} aria-label={`Basket, ${count} items, ${crc(total)}`}>
          <span className="n">{count}</span>
          Basket · {crc(total)}
        </button>
      )}

      {open && (
        <div className="fs-sheet" role="dialog" aria-modal="true" aria-label="Basket">
          <button type="button" className="fs-scrim" aria-label="Close basket" onClick={() => setOpen(false)} />
          <div className="fs-panel">
            <div className="fs-ph">
              <h2>Basket</h2>
              <button type="button" className="btn quiet sm" onClick={() => setOpen(false)}>Close</button>
            </div>
            {lines.length === 0 ? (
              <p className="fs-empty">Your basket is empty.</p>
            ) : (
              <ul className="fs-lines">
                {lines.map((l) => (
                  <li key={l.id}>
                    <div>
                      <b>{l.g.name}</b>
                      {l.label && <span className="sub"> · {l.label}</span>}
                      <div className="sub">
                        {crc(memberPrice(l.price, percent))} each
                        {memberPrice(l.price, percent) !== l.price && <s className="was">{crc(l.price)}</s>}
                      </div>
                    </div>
                    <div className="fs-qty">
                      <button type="button" aria-label="One fewer" onClick={() => add(l.id, -1)}>−</button>
                      <span>{l.qty}</span>
                      <button type="button" aria-label="One more" onClick={() => add(l.id, 1)} disabled={l.qty >= MAX_QTY}>+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lines.length > 0 && (
              <div className="fs-pf">
                <dl className="fs-sum">
                  {discount > 0 && (
                    <>
                      <dt>Full price</dt>
                      <dd>{crc(subtotal)}</dd>
                      <dt>Member discount ({percent}%)</dt>
                      <dd className="off">−{crc(discount)}</dd>
                    </>
                  )}
                  <dt className="tot">Total</dt>
                  <dd className="tot">{crc(total)}</dd>
                </dl>
                {!member && wouldSave > 0 && (
                  <p className="fs-nudge">
                    Members save from {crc(wouldSave)} on this basket.{" "}
                    <a href="/portal/login?next=/farm-shop">Sign in</a> or <a href="/ark-membership">see memberships</a>.
                  </p>
                )}
                {payReady ? (
                  <>
                    {member ? (
                      <p className="sub">Ordering as {member.name || member.email}. Your receipt goes to {member.email}.</p>
                    ) : (
                      <div className="fs-who">
                        <label>
                          Your name
                          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                        </label>
                        <label>
                          Email for your receipt
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                        </label>
                      </div>
                    )}
                    <p className="sub">Pay by card, then pick your order up at The ARK.</p>
                    <button type="button" className="btn solid" disabled={paying} onClick={pay}>
                      {paying ? "Opening payment…" : `Pay ${crc(total)}`}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="sub">Paying here isn’t open yet. You can check out on thearkfarm.shop.</p>
                    <a className="btn solid" href={shopUrl} target="_blank" rel="noopener noreferrer">Check out on thearkfarm.shop</a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
