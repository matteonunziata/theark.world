import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/dates";
import { tierName } from "@/lib/facilitator-pay";
import { loadAnalytics, PERIODS, type Period } from "./load";

export const metadata: Metadata = { title: "Class analytics" };

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireStaff("events");
  const { today, period, anchor, from, upTo, step, label, classes, live, held, sessionRows } = await loadAnalytics(
    supabase,
    await searchParams,
  );

  const rows = classes
    .map((o) => {
      const mine = live.filter((r) => r.offering_id === o.id);
      const booked = mine.length;
      const checked = mine.filter((r) => r.checked_in_at).length;
      const n = held.get(o.id) ?? 0;
      return {
        o,
        sessions: n,
        booked,
        checked,
        rate: pct(checked, booked),
        avg: n ? checked / n : 0,
        fill: o.capacity && n ? pct(checked, o.capacity * n) : null,
      };
    })
    .filter((r) => r.sessions || r.booked)
    .sort((a, b) => b.checked - a.checked || a.o.title.localeCompare(b.o.title));

  const total = rows.reduce((s, r) => s + r.checked, 0);
  const totalBooked = rows.reduce((s, r) => s + r.booked, 0);
  const max = Math.max(1, ...rows.map((r) => r.checked));
  const link = (np: Period, nd = anchor) => `/events/analytics?p=${np}&d=${nd}`;

  const crc = (n: number) => `₡${n.toLocaleString("en-US")}`;
  const done = sessionRows.filter((x) => !x.cancelled);
  const pay = new Map<string, { sessions: number; checked: number; pay: number }>();
  for (const x of done) {
    const c = pay.get(x.facilitator) ?? { sessions: 0, checked: 0, pay: 0 };
    c.sessions++;
    c.checked += x.checked;
    c.pay += x.pay;
    pay.set(x.facilitator, c);
  }
  const payRows = [...pay.entries()].sort((a, b) => b[1].pay - a[1].pay || a[0].localeCompare(b[0]));
  const totalPay = payRows.reduce((n, [, c]) => n + c.pay, 0);
  const exportHref = (fmt: string, report: string) => `/events/analytics/export?p=${period}&d=${anchor}&report=${report}&fmt=${fmt}`;

  const top = rows[0]?.checked ? rows[0] : null;
  const rated = rows.filter((r) => r.booked >= 3 && r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const avgBest = [...rows].filter((r) => r.sessions && r.checked).sort((a, b) => b.avg - a.avg)[0];
  const quiet = rows.filter((r) => r.sessions && !r.checked);

  return (
    <>
      <div className="toolbar">
        <div className="weeknav" style={{ margin: 0, flex: 1 }}>
          <span className="range">{label}</span>
          <Link className="btn" href={link(period, step(-1))}>Previous</Link>
          <Link className="btn" href={link(period, today)}>{period === "day" ? "Today" : period === "week" ? "This week" : "This month"}</Link>
          <Link className="btn" href={link(period, step(1))}>Next</Link>
        </div>
        <nav className="tabs" aria-label="Period" style={{ margin: 0 }}>
          {PERIODS.map(([k, l]) => (
            <Link key={k} href={link(k)} aria-current={period === k ? "page" : undefined}>
              {l}
            </Link>
          ))}
        </nav>
      </div>

      <p style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted">Export this period:</span>
        <a className="btn" href={exportHref("csv", "sessions")}>Sessions CSV</a>
        <a className="btn" href={exportHref("pdf", "sessions")} target="_blank" rel="noopener noreferrer">Sessions PDF</a>
      </p>

      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat"><b>{total}</b><span>Checked in</span></div>
        <div className="stat"><b>{totalBooked}</b><span>Booked</span></div>
        <div className="stat"><b>{pct(total, totalBooked) === null ? "—" : `${pct(total, totalBooked)}%`}</b><span>Showed up</span></div>
        <div className="stat"><b>{[...held.values()].reduce((a, b) => a + b, 0)}</b><span>Sessions held</span></div>
      </div>

      {!rows.length ? (
        <div className="empty">
          <h2>No class activity</h2>
          <p>Nothing was booked or held in this period. Try another period, or go back to today.</p>
        </div>
      ) : (
        <>
          <h2 className="subhead">Every session</h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Class</th>
                  <th>Facilitator</th>
                  <th>Booked</th>
                  <th>Checked in</th>
                  <th>Pay tier</th>
                  <th>Facilitator pay</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map((x) => (
                  <tr key={`${x.o.id}|${x.date}`} className={x.cancelled ? "muted" : ""}>
                    <td>
                      {fmtDate(x.date, { weekday: "short", month: "short", day: "numeric" })}
                      {x.o.start_time ? `, ${fmtTime(x.o.start_time)}` : ""}
                    </td>
                    <td><b>{x.o.title}</b>{x.cancelled ? " (cancelled)" : ""}</td>
                    <td>{x.facilitator}</td>
                    <td>{x.booked}</td>
                    <td><b>{x.checked}</b></td>
                    <td>{x.o.facilitator_pay_tier} · {tierName(x.o.facilitator_pay_tier)}</td>
                    <td>{x.cancelled ? "—" : crc(x.pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="subhead" style={{ marginTop: 28 }}>Facilitator pay</h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr><th>Facilitator</th><th>Sessions</th><th>Checked in</th><th>Owed</th></tr>
              </thead>
              <tbody>
                {payRows.map(([name, c]) => (
                  <tr key={name}><td><b>{name}</b></td><td>{c.sessions}</td><td>{c.checked}</td><td>{crc(c.pay)}</td></tr>
                ))}
                <tr><td><b>Total</b></td><td /><td /><td><b>{crc(totalPay)}</b></td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted">
            Pay follows each class’s tier: Free pays nothing, Fixed ₡20,000, Flex by people checked in (0–10 ₡20,000, 11–20 ₡25,000, 21–30 ₡30,000, 31+ ₡35,000). Sessions still to come and cancelled sessions aren’t counted.
          </p>

          <h2 className="subhead" style={{ marginTop: 28 }}>Check-ins by class</h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Sessions</th>
                  <th>Booked</th>
                  <th>Checked in</th>
                  <th>Showed up</th>
                  <th>Avg per session</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.o.id}>
                    <td>
                      <b>{r.o.title}</b>
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${Math.round((r.checked / max) * 100)}%` }} />
                      </div>
                    </td>
                    <td>{r.sessions}</td>
                    <td>{r.booked}</td>
                    <td><b>{r.checked}</b></td>
                    <td className={r.rate === null ? "muted" : ""}>{r.rate === null ? "—" : `${r.rate}%`}</td>
                    <td>{r.sessions ? r.avg.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="subhead" style={{ marginTop: 28 }}>Which classes are doing best</h2>
          {top ? (
            <>
              <div className="stats" style={{ marginBottom: 14 }}>
                <div className="stat">
                  <span>Most check-ins</span>
                  <b style={{ fontSize: 22 }}>{top.o.title}</b>
                  <span>{top.checked} across {top.sessions} {top.sessions === 1 ? "session" : "sessions"}</span>
                </div>
                {avgBest && (
                  <div className="stat">
                    <span>Fullest sessions on average</span>
                    <b style={{ fontSize: 22 }}>{avgBest.o.title}</b>
                    <span>
                      {avgBest.avg.toFixed(1)} per session
                      {avgBest.fill !== null ? `, ${avgBest.fill}% of capacity` : ""}
                    </span>
                  </div>
                )}
                {rated[0] && (
                  <div className="stat">
                    <span>Best show-up rate</span>
                    <b style={{ fontSize: 22 }}>{rated[0].o.title}</b>
                    <span>{rated[0].rate}% of {rated[0].booked} booked came</span>
                  </div>
                )}
              </div>
              <p className="muted">
                Top three by check-ins:{" "}
                {rows
                  .slice(0, 3)
                  .filter((r) => r.checked)
                  .map((r) => `${r.o.title} (${r.checked})`)
                  .join(", ")}
                .
                {quiet.length
                  ? ` ${quiet.length === 1 ? "One class ran" : `${quiet.length} classes ran`} with no check-ins: ${quiet.map((r) => r.o.title).join(", ")}.`
                  : ""}{" "}
                Show-up rate needs at least 3 bookings. Cancelled sessions and sessions still to come aren’t counted.
              </p>
            </>
          ) : (
            <p className="muted">No one has been checked in during this period yet.</p>
          )}
        </>
      )}
    </>
  );
}
