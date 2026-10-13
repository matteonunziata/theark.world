"use client";

import { useState } from "react";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * Pick a nightly rate and see the estimate. 70% occupancy and a 20% management fee, as on the live site.
 * With `maintenance` the yearly fee comes off too and the return on `price` is shown.
 */
export function IncomeCalculator({
  rates,
  initial,
  maintenance,
  price,
}: {
  rates: readonly number[];
  initial: number;
  maintenance?: { label: string; amount: number };
  price?: { amount: number; note: string };
}) {
  const [rate, setRate] = useState(initial);
  const occupancy = 0.7;
  const nights = Math.round(Number((365 * occupancy).toFixed(1)));
  const gross = rate * nights;
  const fee = Math.round(gross * 0.2);
  const net = gross - fee - (maintenance?.amount ?? 0);
  return (
    <div className="calc">
      <div className="filters" role="group" aria-label="Nightly rate">
        {rates.map((r) => (
          <button key={r} type="button" className="filter" aria-pressed={rate === r} onClick={() => setRate(r)}>
            {usd(r)}/night
          </button>
        ))}
      </div>
      <dl className="facts calc-rows" aria-live="polite">
        <dt>Occupancy rate</dt>
        <dd>{Math.round(occupancy * 100)}%</dd>
        <dt>Nights rented per year</dt>
        <dd>{nights}</dd>
        <dt>Gross annual revenue</dt>
        <dd>{usd(gross)}</dd>
        <dt>ARK management fee (20%)</dt>
        <dd>— {usd(fee)}</dd>
        {maintenance && (
          <>
            <dt>{maintenance.label}</dt>
            <dd>— {usd(maintenance.amount)}</dd>
          </>
        )}
      </dl>
      <div className="calc-total">
        <span className="eyebrow">Your estimated annual passive income</span>
        <strong>{usd(net)}</strong>
        {price ? (
          <>
            <span>{((net / price.amount) * 100).toFixed(1)}% ROI</span>
            <span className="note">{price.note}</span>
          </>
        ) : (
          <span className="note">Before profit share distributions from village businesses</span>
        )}
      </div>
    </div>
  );
}
