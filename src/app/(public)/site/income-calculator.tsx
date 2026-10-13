"use client";

import { useState } from "react";

const RATES = [200, 300, 400, 500] as const;
const OCCUPANCY = 0.7;
const FEE = 0.2;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Pick a nightly rate and see the estimate (70% occupancy, 20% management fee). */
export function IncomeCalculator() {
  const [rate, setRate] = useState<number>(300);
  const nights = Math.round(Number((365 * OCCUPANCY).toFixed(1)));
  const gross = rate * nights;
  const fee = Math.round(gross * FEE);
  return (
    <div className="calc">
      <div className="filters" role="group" aria-label="Nightly rate">
        {RATES.map((r) => (
          <button key={r} type="button" className="filter" aria-pressed={rate === r} onClick={() => setRate(r)}>
            {usd(r)}/night
          </button>
        ))}
      </div>
      <dl className="facts calc-rows" aria-live="polite">
        <dt>Occupancy rate</dt>
        <dd>{Math.round(OCCUPANCY * 100)}%</dd>
        <dt>Nights rented per year</dt>
        <dd>{nights}</dd>
        <dt>Gross annual revenue</dt>
        <dd>{usd(gross)}</dd>
        <dt>ARK management fee ({Math.round(FEE * 100)}%)</dt>
        <dd>— {usd(fee)}</dd>
      </dl>
      <div className="calc-total">
        <span className="eyebrow">Your estimated annual passive income</span>
        <strong>{usd(gross - fee)}</strong>
        <span className="note">Before profit share distributions from village businesses</span>
      </div>
    </div>
  );
}
