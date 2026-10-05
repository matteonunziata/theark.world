"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtTotals, type Totals } from "@/lib/finance";
import { fmtMoney } from "@/lib/shop";

export type Activity = {
  at: string;
  area: string;
  title: string;
  detail: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  link: string | null;
};

const STATUS: Record<string, string> = {
  paid: "Paid",
  unpaid: "Owes",
  booked: "Booked",
  inquiry: "Inquiry",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  invited: "Invited",
  used: "Came",
  active: "Active",
  paused: "Paused",
  inactive: "Inactive",
};

const add = (t: Totals, a: Activity) => {
  if (a.amount && a.currency) t[a.currency] = (t[a.currency] ?? 0) + Number(a.amount);
};

/** What someone has bought, booked and paid for, across the business. */
export function ActivityPanel({ items, currency, now }: { items: Activity[]; currency: string; now: string }) {
  const [area, setArea] = useState("");
  const spent: Totals = {};
  const owes: Totals = {};
  const byArea = new Map<string, { n: number; spent: Totals }>();
  for (const a of items) {
    const row = byArea.get(a.area) ?? { n: 0, spent: {} };
    row.n++;
    if (a.status === "paid") {
      add(spent, a);
      add(row.spent, a);
    }
    if (a.status === "unpaid") add(owes, a);
    byArea.set(a.area, row);
  }
  const past = items.filter((a) => new Date(a.at) <= new Date(now) && a.area !== "Membership");
  const last = past[0];
  const visits = byArea.get("Visits")?.n ?? 0;
  const purchases = items.filter((a) => a.amount && a.status !== "cancelled").length;
  const shown = area ? items.filter((a) => a.area === area) : items;
  const hasOwes = Object.values(owes).some(Boolean);

  return (
    <section className="panel">
      <h2>Activity</h2>
      <div className="act-kpis">
        <div>
          <span>Total spent</span>
          <b>{fmtTotals(spent, currency)}</b>
        </div>
        <div>
          <span>Purchases</span>
          <b>{purchases}</b>
        </div>
        <div>
          <span>Last seen</span>
          <b>{last ? when(last.at, { month: "short", day: "numeric" }) : "—"}</b>
        </div>
        <div>
          <span>{hasOwes ? "Owes" : "Visits"}</span>
          <b className={hasOwes ? "neg" : ""}>{hasOwes ? fmtTotals(owes, currency) : visits}</b>
        </div>
      </div>

      {items.length > 0 && (
        <div className="act-areas" role="group" aria-label="Filter activity">
          <button type="button" className={area ? "" : "on"} onClick={() => setArea("")}>
            All <small>{items.length}</small>
          </button>
          {[...byArea].map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={area === k ? "on" : ""}
              onClick={() => setArea(area === k ? "" : k)}
              title={Object.keys(v.spent).length ? `${fmtTotals(v.spent, currency)} spent` : undefined}
            >
              {k} <small>{v.n}</small>
            </button>
          ))}
        </div>
      )}

      {shown.length ? (
        <ul className="act-list">
          {shown.slice(0, 80).map((a, i) => (
            <li key={`${a.at}-${i}`} className={a.status === "cancelled" ? "off" : ""}>
              <time>{when(a.at, { month: "short", day: "numeric", year: "numeric" })}</time>
              <span className="what">
                <b>{a.link ? <Link href={a.link}>{a.title}</Link> : a.title}</b>
                <span className="muted">
                  {a.area}
                  {a.detail ? `, ${a.detail}` : ""}
                </span>
              </span>
              <span className="amt">
                {a.amount && a.currency ? fmtMoney(Number(a.amount), a.currency) : ""}
                {a.status && STATUS[a.status] && (
                  <small className={`st st-${a.status}`}>{STATUS[a.status]}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Nothing yet. Tickets, stays, court bookings and guest passes show up here on their own. Link
          income in Finance and farm shop sales to this person to see those too.
        </p>
      )}
      {shown.length > 80 && <p className="note">Showing the latest 80 of {shown.length}.</p>}
    </section>
  );
}

const when = (iso: string, opt: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString("en-US", { ...opt, timeZone: "America/Costa_Rica" });
