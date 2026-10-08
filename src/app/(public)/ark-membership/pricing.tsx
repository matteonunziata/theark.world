"use client";

import { useState } from "react";
import { CRC_PER_USD, money, planHref, PLANS, type Plan } from "./plans";

type PassPrices = Record<string, { amount: number; currency: string }>;

const PASS_DESC: Record<string, string> = {
  day: "Full access 8am to 8pm, Shala classes, Space Deck and coworking.",
  week: "Everything in the Day Pass, valid for seven days",
};

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

export function Pricing({ passPrices = {} }: { passPrices?: PassPrices }) {
  const [cur, setCur] = useState<"CRC" | "USD">("CRC");
  const memberships = PLANS.filter((p) => p.kind === "membership");
  const passes = PLANS.filter((p) => p.kind === "pass").map((plan): Plan => {
    // A pass with a Stripe product shows Stripe's price, in colones for the view.
    const sp = passPrices[plan.key];
    return sp ? { ...plan, price: sp.currency === "USD" ? sp.amount * CRC_PER_USD : sp.amount } : plan;
  });

  return (
    <>
      <div className="ms-head">
        <div>
          <p className="ms-eyebrow">Pricing</p>
          <h2>Choose your rhythm.</h2>
        </div>
        <div className="ms-pricing-bar">
          <div className="ms-toggle" role="group" aria-label="Currency">
            {(["CRC", "USD"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={cur === c} onClick={() => setCur(c)}>
                {c === "CRC" ? "CRC ₡" : "USD $"}
              </button>
            ))}
          </div>
          <span className="ms-fine">USD is approximate. Checkout is in colones.</span>
        </div>
      </div>

      <div className="ms-group">
        <div className="ms-group-h">
          <h3>Memberships</h3>
          <span>By application · full access 8am to 8pm · member perks</span>
        </div>
        <div className="ms-plans">
          {memberships.map((p) => {
            const months = Math.round(p.days / 30.4);
            return (
              <article key={p.key} className={`ms-plan${p.key === "year" ? " feature" : ""}`}>
                <div className="ms-plan-top">
                  <h4>{p.name}</h4>
                  {p.badge && <span className="ms-tag">{p.badge}</span>}
                </div>
                <div className="ms-price">
                  <span className="big">
                    <b>{money(p.price / months, cur)}</b>
                    <span>/ month</span>
                  </span>
                  <small>
                    {months === 1 ? "Billed monthly" : `${money(p.price, cur)} for ${months} months, paid upfront`}
                  </small>
                </div>
                <ul>
                  {p.perks.map((x) => (
                    <li key={x}>
                      <Check />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <a className="ms-btn" href={planHref(p)}>
                  Apply for membership
                </a>
              </article>
            );
          })}
        </div>
      </div>

      <div className="ms-group">
        <div className="ms-group-h">
          <h3>Visiting passes</h3>
          <span>No application · buy online and come in</span>
        </div>
        <div className="ms-passes">
          {passes.map((p) => (
            <article key={p.key} className="ms-pass">
              <div>
                <h4>
                  {p.name} <b>{money(p.price, cur)}</b>
                </h4>
                <p>
                  {PASS_DESC[p.key]}
                  {p.days > 1 && ` · ${money(Math.floor(p.price / p.days), cur)}/day`}
                </p>
              </div>
              <a className="ms-btn" href={planHref(p)}>
                Buy a pass
              </a>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
