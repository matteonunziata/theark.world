"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { startShopCheckout } from "./actions";
import { basketTotals, checkoutUrl, type CartLine, cleanCart, MAX_QTY, memberPrice } from "@/lib/shop-cart";

export type Group = {
  key: string;
  name: string;
  category: string;
  image: string | null;
  description: string | null;
  url: string | null;
  options: { id: string; label: string | null; price: number }[];
};

const KEY = "ark-shop-cart";
const crc = (n: number) => `₡${n.toLocaleString("en-US")}`;
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A small copy of the product photo that flies from the card into the basket. */
function fly(from: Element, to: Element, image: string | null) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const size = 56;
  const dot = document.createElement("div");
  dot.className = "sh-fly";
  if (image) dot.style.backgroundImage = `url(${image})`;
  dot.style.left = `${a.left + a.width / 2 - size / 2}px`;
  dot.style.top = `${a.top + a.height / 2 - size / 2}px`;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  // Up and over, landing small in the basket.
  const anim = dot.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy * 0.5, 0) - 80}px) scale(0.8)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 },
    ],
    { duration: 650, easing: "cubic-bezier(.45,.05,.4,1)" },
  );
  return anim.finished.catch(() => undefined).finally(() => dot.remove());
}

export function Shop({
  groups,
  percent,
  code,
  email,
  payReady,
  justPaid,
}: {
  groups: Group[];
  percent: number;
  code: string | null;
  email: string | null;
  payReady: boolean;
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
  const basketRef = useRef<HTMLButtonElement>(null);

  // The cart is kept in this browser, so it survives leaving for checkout and coming back.
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
    return it ? [{ ...l, ...it }] : []; // a product that's gone from the shop drops out
  });
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const { subtotal, discount, total } = basketTotals(lines, percent);
  const url = checkoutUrl(lines, { code, email });
  const pay = () =>
    startPay(async () => {
      const r = await startShopCheckout(lines.map((l) => ({ id: l.id, qty: l.qty })));
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

  /** Add from a product card: the button says so, the photo flies to the basket, and the basket bumps. */
  const addFromCard = (e: MouseEvent<HTMLButtonElement>, g: Group, id: string) => {
    const card = e.currentTarget.closest(".sh-card");
    const from = card?.querySelector(".sh-img") ?? e.currentTarget;
    add(id);
    setAdded((a) => ({ ...a, [g.key]: true }));
    window.setTimeout(() => setAdded((a) => ({ ...a, [g.key]: false })), 1400);
    if (calm()) {
      setBump((n) => n + 1);
      return;
    }
    // Wait a frame so the floating basket is on screen before aiming at it.
    requestAnimationFrame(() => {
      const to = basketRef.current;
      if (!to) return setBump((n) => n + 1);
      void fly(from, to, g.image).then(() => setBump((n) => n + 1));
    });
  };

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">Farm shop</h1>
          <p>
            From the farm and the people we trust.
            {percent > 0 && ` Your member price is ${percent}% off, applied at checkout.`}
          </p>
        </div>
        <button type="button" className="pv-btn sm" onClick={() => setOpen(true)} aria-label={`Basket, ${count} items`}>
          Basket{count ? ` (${count})` : ""}
        </button>
      </div>

      {justPaid && <p className="sh-ok" role="status">Thank you. Your order is paid. Pick it up at The ARK.</p>}
      <div className="sh-bar">
        <input className="sh-search" type="search" placeholder="Search the shop" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the shop" />
      </div>
      <div className="pv-pills" role="group" aria-label="Category">
        <button type="button" className="pv-pill" aria-current={!cat ? "page" : undefined} onClick={() => setCat("")}>
          Everything
        </button>
        {cats.map((c) => (
          <button key={c} type="button" className="pv-pill" aria-current={cat === c ? "page" : undefined} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="sh-empty">{groups.length ? "Nothing matches that." : "The shop is empty right now. Check back soon."}</p>
      ) : (
        <div className="pv-grid sh-grid">
          {shown.map((g) => {
            const id = picked[g.key] ?? g.options[0].id;
            const o = g.options.find((x) => x.id === id) ?? g.options[0];
            const mp = memberPrice(o.price, percent);
            return (
              <article key={g.key} className="pv-card sh-card">
                <div className="img sh-img" style={g.image ? { backgroundImage: `url(${g.image})` } : undefined} role="img" aria-label={g.name} />
                <div className="body">
                  <h3>{g.name}</h3>
                  <div className="sub">{g.category}</div>
                  {g.options.length > 1 && (
                    <select className="sh-opt" aria-label={`Option for ${g.name}`} value={o.id} onChange={(e) => setPicked((p) => ({ ...p, [g.key]: e.target.value }))}>
                      {g.options.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label} · {crc(memberPrice(x.price, percent))}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="foot sh-foot">
                    <span className="sh-price">
                      <b>{crc(mp)}</b>
                      {mp !== o.price && <s>{crc(o.price)}</s>}
                    </span>
                    <button
                      type="button"
                      className={`pv-btn sm sh-add${added[g.key] ? " done" : ""}`}
                      onClick={(e) => addFromCard(e, g, o.id)}
                    >
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
        <button
          ref={basketRef}
          type="button"
          key={bump}
          className={`sh-float${bump ? " bump" : ""}`}
          onClick={() => setOpen(true)}
          aria-label={`Basket, ${count} items, ${crc(total)}`}
        >
          <span className="n">{count}</span>
          Basket · {crc(total)}
        </button>
      )}

      {open && (
        <div className="sh-sheet" role="dialog" aria-modal="true" aria-label="Basket">
          <button type="button" className="sh-scrim" aria-label="Close basket" onClick={() => setOpen(false)} />
          <div className="sh-panel">
            <div className="sh-ph">
              <h2>Basket</h2>
              <button type="button" className="pv-btn ghost sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {lines.length === 0 ? (
              <p className="sh-empty">Your basket is empty.</p>
            ) : (
              <ul className="sh-lines">
                {lines.map((l) => (
                  <li key={l.id}>
                    <div>
                      <b>{l.g.name}</b>
                      {l.label && <span className="sub"> · {l.label}</span>}
                      <div className="sub">
                        {crc(memberPrice(l.price, percent))} each
                        {memberPrice(l.price, percent) !== l.price && <s className="sh-was">{crc(l.price)}</s>}
                      </div>
                    </div>
                    <div className="sh-qty">
                      <button type="button" aria-label="One fewer" onClick={() => add(l.id, -1)}>−</button>
                      <span>{l.qty}</span>
                      <button type="button" aria-label="One more" onClick={() => add(l.id, 1)} disabled={l.qty >= MAX_QTY}>+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lines.length > 0 && (
              <div className="sh-pf">
                <dl className="sh-sum">
                  {discount > 0 && (
                    <>
                      <dt>Full price</dt>
                      <dd>{crc(subtotal)}</dd>
                      <dt>Member discount ({percent}%)</dt>
                      <dd className="sh-off">−{crc(discount)}</dd>
                    </>
                  )}
                  <dt className="sh-tot">Total</dt>
                  <dd className="sh-tot">{crc(total)}</dd>
                </dl>
                {payReady ? (
                  <>
                    <p className="sub">
                      {discount > 0 ? `You save ${crc(discount)} with your member price. ` : ""}
                      Pay by card, then pick your order up at The ARK.
                    </p>
                    <button type="button" className="pv-btn" disabled={paying} onClick={pay}>
                      {paying ? "Opening payment…" : `Pay ${crc(total)}`}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="sub">
                      Paying in the portal isn’t open yet. You can check out on thearkfarm.shop
                      {code ? `, where your ${percent}% member discount (${code}) is added` : ""}.
                    </p>
                    <a className="pv-btn" href={url ?? "#"} target="_blank" rel="noopener noreferrer">
                      Check out on thearkfarm.shop
                    </a>
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
