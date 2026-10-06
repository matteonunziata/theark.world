import { BOOKING_DAYS } from "@/lib/courts";
import { addDays, todayIn } from "@/lib/dates";
import type { PortalData } from "@/lib/portal";
import { sessions } from "@/lib/schedule";
import { CourtsBooking } from "./courts-booking";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The Courts tab of the portal schedule. */
export async function CourtsSection({ p, date: d }: { p: PortalData; date?: string }) {
  const today = todayIn(p.timezone);
  const last = addDays(today, BOOKING_DAYS);
  const date = d && ISO.test(d) && d >= today && d <= last ? d : today;
  const [{ data: courts }, { data: taken }, { data: offerings }, { data: cancels }, { data: mine }] = await Promise.all([
    p.supabase.from("courts").select("id, name, sport, open_time, close_time, slot_minutes").eq("active", true).order("position"),
    p.supabase.rpc("court_day", { p_date: date }),
    p.supabase.from("offerings").select("*").eq("status", "published").ilike("location", "%court%"),
    p.supabase.from("session_cancellations").select("offering_id, session_date").eq("session_date", date),
    p.memberId ? p.supabase.rpc("my_court_bookings") : Promise.resolve({ data: [] }),
  ]);
  const classes = sessions(offerings ?? [], cancels ?? [], date, date)
    .filter((s) => !s.cancelled)
    .map((s) => s.o);
  const now = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: p.timezone,
  }).format(new Date());
  return (
    <CourtsBooking
      courts={courts ?? []}
      taken={taken ?? []}
      classes={classes}
      mine={mine ?? []}
      date={date}
      today={today}
      now={now}
      isMember={!!p.memberId}
    />
  );
}
