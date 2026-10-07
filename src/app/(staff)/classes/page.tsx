import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, dayLabel, timeRange, todayIn } from "@/lib/dates";
import { sessions } from "@/lib/schedule";

export const metadata: Metadata = { title: "My classes" };

const DAYS_AHEAD = 13;

export default async function MyClasses() {
  const { staff, supabase } = await requireStaff("classes");
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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My classes</h1>
          <p className="lede">
            Your sessions for the next two weeks. Open one to see who’s coming
            and check people in.
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
        <aside className="fac-list" aria-label="Your sessions" style={{ position: "static", maxWidth: 640 }}>
          {list.map((x) => {
            const k = `${x.o.id}|${x.date}`;
            const n = booked.get(k) ?? 0;
            return (
              <Link
                key={k}
                href={`/classes/${x.o.id}/${x.date}`}
                className={`fac-sess ${x.cancelled ? "off" : ""}`}
              >
                <span>
                  <b>{x.o.title}</b>
                  <small>
                    {dayLabel(x.date, today)}
                    {timeRange(x.o) && `, ${timeRange(x.o)}`}
                    {x.o.location && ` · ${x.o.location}`}
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
      )}
    </div>
  );
}
