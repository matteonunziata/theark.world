import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { dayLabel, timeRange, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookings() {
  const { supabase, user } = await getViewer();
  const today = todayIn();
  const { data } = await supabase
    .from("registrations")
    .select("id, session_date, qr_token, checked_in_at, offering:offerings(title, start_time, end_time, location)")
    .eq("user_id", user!.id)
    .gte("session_date", today)
    .order("session_date");
  const list = (data ?? []).filter((r) => r.offering);
  return !list.length ? (
    <div className="empty">
      <h2>No upcoming bookings</h2>
      <p>
        Book a class or event from the <Link href="/portal">schedule</Link>.
        Your tickets show up here.
      </p>
    </div>
  ) : (
    <div className="list">
      {list.map((r) => (
        <Link
          className="row qrow"
          key={r.id}
          href={`/t/${r.qr_token}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="who" style={{ display: "block" }}>
            <b>{r.offering!.title}</b>
            <span>
              {dayLabel(r.session_date, today)}, {timeRange(r.offering!)}
              {r.offering!.location ? ` at ${r.offering!.location}` : ""}
            </span>
          </span>
          <span />
          <span className="muted">{r.checked_in_at ? "Checked in" : ""}</span>
          <span className="acts">
            <span className="btn">Ticket</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
