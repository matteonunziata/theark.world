"use client";

import { useState } from "react";
import { CRC_PER_USD, money, planHref, PLANS } from "./plans";

export function Pricing({ passPrices = {} }: { passPrices?: Record<string, { amount: number; currency: string }> }) {
  const [cur, setCur] = useState<"CRC" | "USD">("CRC");
  return (
    <>
      <div className="ms-toggle" role="group" aria-label="Currency">
        {(["CRC", "USD"] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cur === c} onClick={() => setCur(c)}>
            {c === "CRC" ? "CRC (₡)" : "USD ($)"}
          </button>
        ))}
      </div>
      <p className="ms-fine">USD prices are approximate. Checkout is in Costa Rican colones.</p>
      <div className="ms-plans">
        {PLANS.map((plan) => {
          // A pass with a Stripe product shows Stripe's price, in colones for the view.
          const sp = passPrices[plan.key];
          const p = sp
            ? { ...plan, price: sp.currency === "USD" ? sp.amount * CRC_PER_USD : sp.amount }
            : plan;
          return (
          <article key={p.key} className={`ms-plan${p.badge ? " feature" : ""}`}>
            {p.badge && <span className="ms-badge">{p.badge}</span>}
            <h3>{p.name}</h3>
            <p className="ms-price">
              {money(p.price, cur)}
              {p.days > 1 && <span> · {money(Math.floor(p.price / p.days), cur)}/day</span>}
            </p>
            {p.note && <p className="ms-plan-note">{p.note}</p>}
            <ul>
              {p.perks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <a className={`ms-btn${p.kind === "membership" ? " solid" : ""}`} href={planHref(p)}>
              {p.kind === "pass" ? "Buy a pass" : "Apply for membership"}
            </a>
          </article>
          );
        })}
      </div>
    </>
  );
}
