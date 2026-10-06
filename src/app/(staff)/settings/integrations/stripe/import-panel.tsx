"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fmtDate } from "@/lib/dates";
import { importStripeBatch } from "./actions";

type Totals = {
  seen: number;
  imported: number;
  skipped: number;
  linked: number;
  otherCurrency: number;
  failed: number;
};

const ZERO: Totals = { seen: 0, imported: 0, skipped: 0, linked: 0, otherCurrency: 0, failed: 0 };

/** Imports every past Stripe payment, one page at a time, with a running count. */
export function ImportPanel({ imported, live }: { imported: number; live: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [t, setT] = useState<Totals | null>(null);
  const [oldest, setOldest] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstError, setFirstError] = useState<string | null>(null);
  const stop = useRef(false);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setDone(false);
    setError(null);
    setFirstError(null);
    let sum = { ...ZERO };
    setT(sum);
    let next: string | null = null;
    try {
      do {
        const r = await importStripeBatch(next);
        if (!r.ok) {
          setError(r.error);
          break;
        }
        sum = {
          seen: sum.seen + r.seen,
          imported: sum.imported + r.imported,
          skipped: sum.skipped + r.skipped,
          linked: sum.linked + r.linked,
          otherCurrency: sum.otherCurrency + r.otherCurrency,
          failed: sum.failed + r.failed,
        };
        setT(sum);
        if (r.oldest) setOldest(r.oldest);
        if (r.firstError) setFirstError((f) => f ?? r.firstError);
        next = r.next;
        if (!next) setDone(true);
      } while (next && !stop.current);
    } catch {
      setError("The import stopped part way. Start it again; payments already brought in are skipped.");
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <section className="panel">
      <div className="panel-h">
        <div>
          <h2>Import past payments</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Brings every successful payment in your Stripe account into Finance as income, on the day it was paid, with
            refunds and Stripe’s monthly fees as expenses. People are linked when their email is already in the CRM;
            nobody new is added. The business line is a best guess from the payment’s description; move entries in
            Finance if it guessed wrong. Running it again only adds what’s new.
          </p>
        </div>
      </div>
      {!live && (
        <p className="note">Stripe is on test keys, so this would import test payments, not real ones.</p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {t && (
        <p style={{ margin: "0 0 12px" }}>
          {running ? "Importing… " : done ? "Done. " : "Stopped. "}
          Checked {t.seen.toLocaleString("en-US")} payments
          {oldest ? `, back to ${fmtDate(oldest, { month: "short", day: "numeric", year: "numeric" })}` : ""}:{" "}
          {t.imported.toLocaleString("en-US")} added ({t.linked.toLocaleString("en-US")} linked to people),{" "}
          {t.skipped.toLocaleString("en-US")} already in ARK OS or not completed
          {t.otherCurrency ? `, ${t.otherCurrency} in other currencies left out` : ""}
          {t.failed ? `, ${t.failed} couldn’t be added` : ""}.
          {firstError && (
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              First problem: {firstError}
            </span>
          )}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {running ? (
          <button type="button" className="btn" onClick={() => (stop.current = true)}>
            Stop after this page
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={run}>
            {imported > 0 ? "Import new payments" : "Import all past payments"}
          </button>
        )}
        {imported > 0 && !t && (
          <span className="muted">{imported.toLocaleString("en-US")} payments imported so far.</span>
        )}
      </div>
    </section>
  );
}
