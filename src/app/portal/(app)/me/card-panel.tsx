"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { removeCard, startSaveCard } from "../../actions";

export type SavedCard = { brand: string; last4: string; exp_month: number; exp_year: number };

const BRAND: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function CardPanel({ card }: { card: SavedCard | null }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      // On success the action sends the browser to Stripe; we only come back here with a problem.
      const r = await startSaveCard();
      if (!r.ok) toast(r.error ?? "");
    });
  const remove = () =>
    confirm("Remove your saved card?") &&
    start(async () => {
      const r = await removeCard();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <section className="pv-panel">
      <h2>Payment method</h2>
      {card ? (
        <>
          <dl className="pv-kv">
            <dt>Card</dt>
            <dd>
              {BRAND[card.brand] ?? "Card"} ending {card.last4}
            </dd>
            <dt>Expires</dt>
            <dd>
              {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
            </dd>
          </dl>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" className="pv-btn ghost sm" disabled={busy} onClick={save}>
              {busy ? "One moment…" : "Replace card"}
            </button>
            <button type="button" className="pv-btn ghost sm" disabled={busy} onClick={remove}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ marginTop: -6, color: "var(--pv-muted)" }}>
            Keep a card on file so paying for your membership and bookings is quicker. Nothing is charged when you save it.
          </p>
          <button type="button" className="pv-btn" disabled={busy} onClick={save}>
            {busy ? "One moment…" : "Save a card"}
          </button>
        </>
      )}
      <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--pv-muted)" }}>
        Your card is kept by Stripe. We only see its brand, last four digits and expiry.
      </p>
    </section>
  );
}
