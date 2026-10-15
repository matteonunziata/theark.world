import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, todayIn } from "@/lib/dates";
import { isLapsed, summarize } from "@/lib/event-stats";
import { money, occurrences } from "@/lib/schedule";
import { EventSubTabs } from "../event-subtabs";

export const metadata: Metadata = { title: "Event analytics" };

type Search = Record<string, string | string[] | undefined>;

/** Every event with its own numbers; open one for the attendee list. Classes have their own analytics. */
export default async function EventAnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireStaff("events");
  const show = (await searchParams).show === "all" ? "all" : "upcoming";
  const today = todayIn();

  const [{ data: offerings }, { data: tickets }, { data: cancels }] = await Promise.all([
    supabase.from("offerings").select("*").eq("kind", "event").order("title"),
    supabase.from("ticket_types").select("*").order("position"),
    supabase.from("session_cancellations").select("offering_id, session_date"),
  ]);
  const events = offerings ?? [];
  const ids = new Set(events.map((o) => o.id));

  type Reg = Awaited<ReturnType<typeof page>>[number];
  async function page(at: number) {
    const { data } = await supabase
      .from("registrations")
      .select("offering_id, status, hold_until, paid, seats, created_at, session_date, items:registration_items(ticket_type_id, qty, unit_price, currency)")
      .order("id")
      .range(at, at + 999);
    return data ?? [];
  }
  const regs: Reg[] = [];
  for (let at = 0; ; at += 1000) {
    const batch = await page(at);
    regs.push(...batch.filter((r) => ids.has(r.offering_id)));
    if (batch.length < 1000) break;
  }

  const gone = new Set((cancels ?? []).map((c) => `${c.offering_id}|${c.session_date}`));
  const fmt = (m: Record<string, number>) => {
    const parts = Object.entries(m).filter(([, n]) => n > 0).map(([c, n]) => money(n, c));
    return parts.length ? parts.join(" + ") : money(0, "CRC");
  };

  const rows = events
    .map((o) => {
      const mine = regs.filter((r) => r.offering_id === o.id && !isLapsed(r));
      const stats = summarize(
        mine.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })) })),
        (tickets ?? []).filter((t) => t.offering_id === o.id).map((t) => ({ id: t.id, name: t.name, kind: t.kind, qty: t.qty, position: t.position })),
        (iso) => iso.slice(0, 10),
      );
      const dates = occurrences(o, "2000-01-01", "2100-01-01").filter((x) => !gone.has(`${o.id}|${x}`));
      const next = dates.find((x) => x >= today) ?? null;
      const last = dates[dates.length - 1] ?? null;
      return { o, stats, next, last, upcoming: next !== null };
    })
    .filter((r) => show === "all" || r.upcoming)
    .sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999") || a.o.title.localeCompare(b.o.title));

  return (
    <>
      <EventSubTabs />
      <div className="toolbar">
        <nav className="tabs" aria-label="Which events" style={{ margin: 0 }}>
          <Link href="/events/event-analytics" aria-current={show === "upcoming" ? "page" : undefined}>Upcoming</Link>
          <Link href="/events/event-analytics?show=all" aria-current={show === "all" ? "page" : undefined}>All events</Link>
        </nav>
      </div>
      <p className="muted">
        Open an event to see who is coming, the tickets and add-ons booked, and to print or export its attendee list.
        Classes are in Class analytics.
      </p>

      {!rows.length ? (
        <div className="empty">
          <h2>No events</h2>
          <p>{show === "upcoming" ? "No event has a date coming up." : "No events yet."}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="lines-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Next date</th>
                <th>Bookings</th>
                <th>Tickets sold</th>
                <th>Revenue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, stats, next, last }) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/events/event-analytics/${o.id}`}><b>{o.title}</b></Link>
                    {o.status !== "published" && <span className="muted"> · {o.status}</span>}
                  </td>
                  <td>{next ? fmtDate(next, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : last ? `Ended ${fmtDate(last, { month: "short", day: "numeric", year: "numeric" })}` : "—"}</td>
                  <td>
                    {stats.registrations}
                    {stats.pending ? <span className="muted"> + {stats.pending} pending</span> : null}
                  </td>
                  <td>{o.capacity ? `${stats.ticketsSold} / ${o.capacity}` : stats.ticketsSold}</td>
                  <td>{fmt(stats.revenue)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn sm" href={`/events/event-analytics/${o.id}`}>Attendees</Link>{" "}
                    <a className="btn sm" href={`/events/event-analytics/${o.id}/export?fmt=csv`}>CSV</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
