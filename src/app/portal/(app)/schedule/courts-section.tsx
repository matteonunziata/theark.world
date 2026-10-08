import type { DayRow } from "@/app/(public)/courts/court-booker";
import { BOOKING_DAYS, type PublicCourt } from "@/lib/courts";
import { addDays, todayIn } from "@/lib/dates";
import type { PortalData } from "@/lib/portal";
import { stripeReady } from "@/lib/stripe";
import { CourtsBooking } from "./courts-booking";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The Courts tab of the portal schedule. */
export async function CourtsSection({ p, date: d }: { p: PortalData; date?: string }) {
  const today = todayIn(p.timezone);
  const last = addDays(today, BOOKING_DAYS);
  const date = d && ISO.test(d) && d >= today && d <= last ? d : today;
  const [{ data: courts }, { data: day }, { data: mine }, { data: discount }] = await Promise.all([
    p.supabase.rpc("public_courts"),
    p.supabase.rpc("public_court_day", { p_date: date }),
    p.memberId ? p.supabase.rpc("my_court_bookings") : Promise.resolve({ data: [] }),
    p.supabase.rpc("my_court_discount"),
  ]);
  const now = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: p.timezone,
  }).format(new Date());
  return (
    <CourtsBooking
      courts={(courts ?? []) as PublicCourt[]}
      day={(day ?? []) as DayRow[]}
      mine={mine ?? []}
      date={date}
      today={today}
      now={now}
      isMember={!!p.memberId}
      online={stripeReady()}
      discount={Number(discount ?? 0)}
    />
  );
}
