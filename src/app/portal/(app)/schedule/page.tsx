import type { Metadata } from "next";
import { EventLink } from "../../booking-modal";
import Link from "next/link";
import { addDays, addMonths, DOW, fmtDate, fmtTime, monthLabel, timeRange, todayIn, weekStart } from "@/lib/dates";
import { monthGrid } from "@/lib/estate";
import { loadPortal } from "@/lib/portal";
import { KINDS, kindName, type Session, sessions } from "@/lib/schedule";

export const metadata: Metadata = { title: "Schedule" };

const VIEWS = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
] as const;
type View = (typeof VIEWS)[number][0];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function SchedulePage({ searchParams }: PageProps<"/portal/schedule">) {
  const sp = await searchParams;
  const p = await loadPortal();
  const today = todayIn(p.timezone);
  const view: View = VIEWS.some(([v]) => v === sp.view) ? (sp.view as View) : "week";
  const date = typeof sp.date === "string" && ISO.test(sp.date) ? sp.date : today;
  const kind = typeof sp.kind === "string" && KINDS.some(([k]) => k === sp.kind) ? sp.kind : "";

  const grid = monthGrid(date);
  const [from, to] =
    view === "day"
      ? [date, date]
      : view === "week"
        ? [weekStart(date), addDays(weekStart(date), 6)]
        : [grid.days[0], grid.days[41]];

  const [offerings, cancels, facs, mine] = await Promise.all([
    p.supabase.from("offerings").select("*").eq("status", "published"),
    p.supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", from).lte("session_date", to),
    p.supabase.rpc("facilitator_names"),
    p.me
      ? p.supabase
          .from("registrations")
          .select("offering_id, session_date")
          .or(`user_id.eq.${p.user!.id},contact_id.eq.${p.me.id}`)
          .gte("session_date", from)
          .lte("session_date", to)
      : Promise.resolve({ data: [] as { offering_id: string; session_date: string }[] }),
  ]);
  const list = sessions(
    (offerings.data ?? []).filter((o) => o.kind !== "expedition" && (!p.city || !o.city_id || o.city_id === p.city.id)),
    cancels.data ?? [],
    from,
    to,
    { published: true, kind },
  );

  // Spots taken, per offering in view (day and week only; the month stays light).
  const taken = new Map<string, number>();
  if (view !== "month") {
    const ids = [...new Set(list.filter((s) => s.o.capacity).map((s) => s.o.id))];
    const counts = await Promise.all(
      ids.map((id) => p.supabase.rpc("session_counts", { p_offering_id: id, p_from: from, p_to: to })),
    );
    ids.forEach((id, i) => {
      for (const c of counts[i].data ?? []) {
        const k = `${id}|${c.session_date}`;
        taken.set(k, (taken.get(k) ?? 0) + Number(c.taken));
      }
    });
  }
  const booked = new Set((mine.data ?? []).map((r) => `${r.offering_id}|${r.session_date}`));
  const fac = (id: string | null) => (facs.data ?? []).find((f) => f.id === id)?.name;

  const q = (next: { view?: View; date?: string; kind?: string }) => {
    const s = new URLSearchParams();
    s.set("view", next.view ?? view);
    s.set("date", next.date ?? date);
    const k = next.kind ?? kind;
    if (k) s.set("kind", k);
    return `/portal/schedule?${s}`;
  };
  const step = view === "day" ? 1 : 7;
  const prev = view === "month" ? `${addMonths(date.slice(0, 7), -1)}-01` : addDays(date, -step);
  const next = view === "month" ? `${addMonths(date.slice(0, 7), 1)}-01` : addDays(date, step);
  const title =
    view === "day"
      ? fmtDate(date, { weekday: "long", month: "long", day: "numeric" })
      : view === "week"
        ? `${fmtDate(from, { month: "short", day: "numeric" })} – ${fmtDate(to, { month: "short", day: "numeric", year: "numeric" })}`
        : monthLabel(date.slice(0, 7));

  const props = { today, taken, booked, fac };

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 40, margin: 0 }}>Schedule</h1>
          <p>Classes and gatherings{p.city ? ` in ${p.city.name}` : ""}. Tap one to sign up.</p>
        </div>
        <Link className="pv-btn ghost sm" href="/portal/courts">Book a court</Link>
      </div>

      <div className="sch-bar">
        <div className="sch-views" role="group" aria-label="View">
          {VIEWS.map(([v, l]) => (
            <Link key={v} href={q({ view: v })} aria-current={view === v ? "page" : undefined}>
              {l}
            </Link>
          ))}
        </div>
        <div className="sch-nav">
          <Link className="pv-btn ghost sm" href={q({ date: prev })} aria-label="Previous">←</Link>
          <Link className="pv-btn ghost sm" href={q({ date: today })}>Today</Link>
          <Link className="pv-btn ghost sm" href={q({ date: next })} aria-label="Next">→</Link>
        </div>
        <h2 className="sch-title">{title}</h2>
      </div>

      <div className="pv-pills" role="group" aria-label="What" style={{ marginBottom: 18 }}>
        <Link className="pv-pill" href={q({ kind: "" })} aria-current={!kind ? "page" : undefined}>
          Everything
        </Link>
        {KINDS.filter(([k]) => k !== "expedition").map(([v, l]) => (
          <Link key={v} className="pv-pill" href={q({ kind: v })} aria-current={kind === v ? "page" : undefined}>
            {l === "Class" ? "Classes" : `${l}s`}
          </Link>
        ))}
      </div>

      {view === "day" && (
        <>
          <div className="sch-strip">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)).map((d) => (
              <Link key={d} href={q({ date: d })} aria-current={d === date ? "page" : undefined} className={d === today ? "today" : ""}>
                <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                <b>{Number(d.slice(8))}</b>
              </Link>
            ))}
          </div>
          <DayList items={list.filter((s) => s.date === date)} {...props} />
        </>
      )}

      {view === "week" && (
        <div className="sch-week">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const items = list.filter((s) => s.date === d);
            return (
              <section key={d} className={`sch-col ${d === today ? "today" : ""} ${d < today ? "past" : ""}`}>
                <Link href={q({ view: "day", date: d })} className="sch-col-h">
                  <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                  <b>{Number(d.slice(8))}</b>
                </Link>
                {items.length ? (
                  items.map((s) => <Block key={`${s.o.id}-${s.date}`} s={s} {...props} />)
                ) : (
                  <p className="sch-none">Nothing on</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div className="sch-month">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="sch-dow">{d}</div>
          ))}
          {grid.days.map((d) => {
            const items = list.filter((s) => s.date === d && !s.cancelled);
            const inMonth = d.slice(0, 7) === date.slice(0, 7);
            return (
              <Link
                key={d}
                href={q({ view: "day", date: d })}
                className={`sch-cell ${inMonth ? "" : "out"} ${d === today ? "today" : ""} ${d < today ? "past" : ""}`}
                aria-label={`${fmtDate(d, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} on`}
              >
                <b>{Number(d.slice(8))}</b>
                {items.slice(0, 3).map((s) => (
                  <span key={s.o.id} className={`sch-dot k-${s.o.kind} ${booked.has(`${s.o.id}|${d}`) ? "mine" : ""}`}>
                    {fmtTime(s.o.start_time)} {s.o.title}
                  </span>
                ))}
                {items.length > 3 && <span className="sch-more">+{items.length - 3} more</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

type Props = {
  today: string;
  taken: Map<string, number>;
  booked: Set<string>;
  fac: (id: string | null) => string | undefined;
};

function spots(s: Session, taken: Map<string, number>) {
  if (!s.o.capacity) return null;
  return Math.max(0, s.o.capacity - (taken.get(`${s.o.id}|${s.date}`) ?? 0));
}

function status(s: Session, p: Props) {
  if (s.cancelled) return <span className="sch-st off">Cancelled</span>;
  if (p.booked.has(`${s.o.id}|${s.date}`)) return <span className="sch-st mine">You’re booked</span>;
  if (s.date < p.today) return null;
  const left = spots(s, p.taken);
  if (left === 0) return <span className="sch-st off">Full</span>;
  if (left !== null && left <= 5) return <span className="sch-st low">{left} left</span>;
  return null;
}

function Block({ s, ...p }: Props & { s: Session }) {
  return (
    <EventLink id={s.o.id} date={s.date} className={`sch-block k-${s.o.kind} ${s.cancelled ? "cancelled" : ""}`}>
      <span className="t">{timeRange(s.o) || "All day"}</span>
      <b>{s.o.title}</b>
      <span className="m">{[p.fac(s.o.facilitator_id), s.o.location].filter(Boolean).join(" · ")}</span>
      {status(s, p)}
    </EventLink>
  );
}

function DayList({ items, ...p }: Props & { items: Session[] }) {
  if (!items.length) {
    return (
      <div className="pv-empty">
        <h3>Nothing on this day</h3>
        <p>Try another day, or switch to the week view.</p>
      </div>
    );
  }
  return (
    <div className="sch-day">
      {items.map((s) => {
        const mine = p.booked.has(`${s.o.id}|${s.date}`);
        const left = spots(s, p.taken);
        const canBook = !s.cancelled && !mine && s.date >= p.today && left !== 0;
        return (
          <div key={`${s.o.id}-${s.date}`} className={`sch-row k-${s.o.kind} ${s.cancelled ? "cancelled" : ""}`}>
            <span className="tm">
              <b>{fmtTime(s.o.start_time) || "All day"}</b>
              {s.o.end_time && <span>{fmtTime(s.o.end_time)}</span>}
            </span>
            <span className="info">
              <span className="kind">{kindName(s.o.kind)}</span>
              <b>{s.o.title}</b>
              <span className="m">
                {[p.fac(s.o.facilitator_id) ? `with ${p.fac(s.o.facilitator_id)}` : null, s.o.location, left !== null && !s.cancelled ? `${left} of ${s.o.capacity} spots left` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="act">
              {status(s, p)}
              <EventLink className={`pv-btn sm ${canBook ? "" : "ghost"}`} id={s.o.id} date={s.date}>
                {canBook ? "Sign up" : "Details"}
              </EventLink>
            </span>
          </div>
        );
      })}
    </div>
  );
}
