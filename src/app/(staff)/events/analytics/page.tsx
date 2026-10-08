import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, addMonths, fmtDate, monthKey, monthLabel, todayIn, weekStart } from "@/lib/dates";
import { sessions } from "@/lib/schedule";

export const metadata: Metadata = { title: "Class analytics" };

const PERIODS = [
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
] as const;
type Period = (typeof PERIODS)[number][0];

const lastOfMonth = (key: string) => addDays(`${addMonths(key, 1)}-01`, -1);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireStaff("events");
  const { p, d } = await searchParams;
  const today = todayIn();
  const period: Period = p === "day" || p === "month" ? p : "week";
  const anchor = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;

  const from = period === "day" ? anchor : period === "week" ? weekStart(anchor) : `${monthKey(anchor)}-01`;
  const to = period === "day" ? anchor : period === "week" ? addDays(from, 6) : lastOfMonth(monthKey(anchor));
  const upTo = to < today ? to : today; // nothing to measure in the future
  const step = (n: number) =>
    period === "day" ? addDays(anchor, n) : period === "week" ? addDays(anchor, 7 * n) : `${addMonths(monthKey(anchor), n)}-01`;
  const label =
    period === "day"
      ? fmtDate(from, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : period === "week"
        ? `${fmtDate(from, { month: "short", day: "numeric" })} – ${fmtDate(to, { month: "short", day: "numeric", year: "numeric" })}`
        : monthLabel(monthKey(anchor));

  const [{ data: offerings }, { data: cancels }] = await Promise.all([
    supabase.from("offerings").select("*").eq("kind", "class").order("title"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", from).lte("session_date", to),
  ]);
  const classes = offerings ?? [];
  const ids = new Set(classes.map((o) => o.id));

  // Page through the bookings; a month can pass the 1,000-row default.
  type Reg = { offering_id: string; checked_in_at: string | null; status: string; hold_until: string | null };
  const regs: Reg[] = [];
  if (from <= upTo) {
    for (let at = 0; ; at += 1000) {
      const { data } = await supabase
        .from("registrations")
        .select("offering_id, checked_in_at, status, hold_until")
        .gte("session_date", from)
        .lte("session_date", upTo)
        .order("id")
        .range(at, at + 999);
      regs.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const live = regs.filter(
    (r) => ids.has(r.offering_id) && (r.checked_in_at || r.status === "confirmed" || !r.hold_until || new Date(r.hold_until) > new Date()),
  );

  const held = new Map<string, number>();
  if (from <= upTo) {
    for (const s of sessions(classes, cancels ?? [], from, upTo)) {
      if (!s.cancelled) held.set(s.o.id, (held.get(s.o.id) ?? 0) + 1);
    }
  }

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
          <h2 className="subhead">Check-ins by class</h2>
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
