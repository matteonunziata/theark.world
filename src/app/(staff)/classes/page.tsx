import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, dayLabel, fmtDate, timeRange, todayIn } from "@/lib/dates";
import { sessions } from "@/lib/schedule";
import { Roster } from "./roster";

export const metadata: Metadata = { title: "My classes" };

const DAYS_AHEAD = 13;

export default async function MyClasses({ searchParams }: PageProps<"/classes">) {
  const { staff, supabase } = await requireStaff("classes");
  const { s, d } = await searchParams;
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const timezone = org?.timezone ?? "America/Costa_Rica";
  const today = todayIn(timezone);
  const to = addDays(today, DAYS_AHEAD);

  const { data: offerings } = await supabase
    .from("offerings")
    .select("*")
    .eq("facilitator_id", staff.id)
    .eq("status", "published");
  const ids = (offerings ?? []).map((o) => o.id);
  const [{ data: cancels }, { data: regs }] = ids.length
    ? await Promise.all([
        supabase
          .from("session_cancellations")
          .select("offering_id, session_date")
          .in("offering_id", ids)
          .gte("session_date", today)
          .lte("session_date", to),
        supabase
          .from("registrations")
          .select("offering_id, session_date")
          .in("offering_id", ids)
          .gte("session_date", today)
          .lte("session_date", to),
      ])
    : [{ data: [] }, { data: [] }];

  const list = sessions(offerings ?? [], cancels ?? [], today, to);
  const booked = new Map<string, number>();
  for (const r of regs ?? []) {
    const k = `${r.offering_id}|${r.session_date}`;
    booked.set(k, (booked.get(k) ?? 0) + 1);
  }

  const picked =
    list.find((x) => x.o.id === s && x.date === d) ??
    list.find((x) => !x.cancelled) ??
    list[0];

  const { data: roster } = picked
    ? await supabase.rpc("session_roster", { p_offering_id: picked.o.id, p_date: picked.date })
    : { data: [] };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My classes</h1>
          <p className="lede">
            Your sessions for the next two weeks and who’s coming. Check people
            in as they arrive.
          </p>
        </div>
      </div>

      {!list.length ? (
        <div className="empty">
          <h2>No classes on your schedule</h2>
          <p>
            When the team makes you the facilitator of a class, its sessions
            show up here.
          </p>
        </div>
      ) : (
        <div className="fac">
          <section className="fac-main" aria-label="Who’s coming">
            {picked && (
              <>
                <div className="fac-head">
                  <div>
                    <h2>{picked.o.title}</h2>
                    <p>
                      {dayLabel(picked.date, today)},{" "}
                      {fmtDate(picked.date, { month: "long", day: "numeric" })}
                      {timeRange(picked.o) && ` · ${timeRange(picked.o)}`}
                      {picked.o.location && ` · ${picked.o.location}`}
                    </p>
                  </div>
                  <Link className="btn" href={`/qr/${picked.o.id}`} target="_blank">
                    Class QR code
                  </Link>
                </div>
                {picked.cancelled ? (
                  <div className="empty">
                    <h2>This session is cancelled</h2>
                    <p>Members can’t book it, and nobody needs checking in.</p>
                  </div>
                ) : (
                  <Roster
                    key={`${picked.o.id}|${picked.date}`}
                    rows={roster ?? []}
                    timezone={timezone}
                    canCheckIn={picked.date === today}
                    note={
                      picked.date === today
                        ? picked.o.capacity
                          ? `${picked.o.capacity} spots`
                          : undefined
                        : "Check-in opens on the day"
                    }
                  />
                )}
              </>
            )}
          </section>

          <aside className="fac-list" aria-label="Your sessions">
            <h2>Coming up</h2>
            {list.map((x) => {
              const k = `${x.o.id}|${x.date}`;
              const on = picked && picked.o.id === x.o.id && picked.date === x.date;
              const n = booked.get(k) ?? 0;
              return (
                <Link
                  key={k}
                  href={`/classes?s=${x.o.id}&d=${x.date}`}
                  className={`fac-sess ${x.cancelled ? "off" : ""}`}
                  aria-current={on ? "page" : undefined}
                >
                  <span>
                    <b>{x.o.title}</b>
                    <small>
                      {dayLabel(x.date, today)}
                      {timeRange(x.o) && `, ${timeRange(x.o)}`}
                    </small>
                  </span>
                  <span className="n">
                    {x.cancelled
                      ? "Cancelled"
                      : `${n}${x.o.capacity ? `/${x.o.capacity}` : ""} booked`}
                  </span>
                </Link>
              );
            })}
          </aside>
        </div>
      )}
    </div>
  );
}
