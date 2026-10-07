import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dayLabel, fmtDate, timeRange, todayIn } from "@/lib/dates";
import { AddMember } from "../../add-member";
import { Roster } from "../../roster";

export const metadata: Metadata = { title: "Check-in" };

export default async function ClassCheckIn({
  params,
}: {
  params: Promise<{ id: string; date: string }>;
}) {
  const { id, date } = await params;
  const { staff, supabase } = await requireStaff("classes");
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const timezone = org?.timezone ?? "America/Costa_Rica";
  const today = todayIn(timezone);

  const { data: o } = await supabase
    .from("offerings")
    .select("*")
    .eq("id", id)
    .eq("facilitator_id", staff.id)
    .maybeSingle();
  if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [{ data: cancel }, { data: roster }] = await Promise.all([
    supabase
      .from("session_cancellations")
      .select("offering_id")
      .eq("offering_id", id)
      .eq("session_date", date)
      .maybeSingle(),
    supabase.rpc("session_roster", { p_offering_id: id, p_date: date }),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p>
            <Link href="/classes">← My classes</Link>
          </p>
          <h1>{o.title}</h1>
          <p className="lede">
            {dayLabel(date, today)},{" "}
            {fmtDate(date, { month: "long", day: "numeric" })}
            {timeRange(o) && ` · ${timeRange(o)}`}
            {o.location && ` · ${o.location}`}
          </p>
        </div>
        <Link className="btn" href={`/qr/${o.id}`} target="_blank">
          Class QR code
        </Link>
      </div>
      {cancel ? (
        <div className="empty">
          <h2>This session is cancelled</h2>
          <p>Members can’t book it, and nobody needs checking in.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <AddMember offeringId={id} date={date} />
          </div>
          <Roster
            rows={roster ?? []}
            timezone={timezone}
            canCheckIn={date === today}
            note={
              date === today
                ? o.capacity
                  ? `${o.capacity} spots`
                  : undefined
                : "Check-in opens on the day"
            }
          />
        </>
      )}
    </div>
  );
}
