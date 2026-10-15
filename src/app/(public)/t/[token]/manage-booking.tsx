"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelMyBooking, moveMyBooking } from "./manage-actions";

/** Change the date or cancel, from the ticket link in the confirmation email. */
export function ManageBooking({
  token,
  paid,
  dates,
}: {
  token: string;
  paid: boolean;
  dates: { date: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dates[0]?.date ?? "");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => ReturnType<typeof cancelMyBooking>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Couldn’t do that. Try again.");
        return;
      }
      after?.();
      router.refresh();
    });
  };

  return (
    <div id="manage" style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)", textAlign: "left" }}>
      <b style={{ fontSize: 14 }}>Plans changed?</b>
      {error && (
        <div className="form-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {dates.length > 0 && (
        <div className="fld" style={{ marginTop: 10 }}>
          <label htmlFor="mv-date">Move to another date</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select id="mv-date" value={date} onChange={(e) => setDate(e.target.value)} disabled={pending}>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn" disabled={pending || !date} onClick={() => run(() => moveMyBooking(token, date))}>
              {pending ? "Moving…" : "Move booking"}
            </button>
          </div>
        </div>
      )}
      <p style={{ margin: "10px 0 0" }}>
        {open ? (
          <>
            <span className="muted" style={{ fontSize: 14 }}>
              Cancel this booking?{paid ? " It was paid, and cancelling doesn’t refund it automatically. Contact the team about a refund." : ""}{" "}
            </span>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => run(() => cancelMyBooking(token))}
            >
              {pending ? "Cancelling…" : "Yes, cancel"}
            </button>{" "}
            <button type="button" className="linkish" onClick={() => setOpen(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="linkish" onClick={() => setOpen(true)}>
            Cancel booking
          </button>
        )}
      </p>
    </div>
  );
}
