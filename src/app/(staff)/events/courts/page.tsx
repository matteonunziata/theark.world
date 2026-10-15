import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { sessions } from "@/lib/schedule";
import { CourtsView } from "./courts-view";
import type { SBooking } from "./staff-types";

export const metadata: Metadata = { title: "Courts" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function CourtsPage({ searchParams }: PageProps<"/events/courts">) {
  const { date: d } = await searchParams;
  const { supabase, staff } = await requireStaff("events");
  const today = todayIn();
  const date = typeof d === "string" && ISO.test(d) ? d : today;
  const [{ data: courts }, { data: day }, { data: offerings }, { data: cancels }, { data: people }, { data: prices }, { data: config }] =
    await Promise.all([
      supabase.from("courts").select("*").order("position").order("name"),
      supabase.rpc("staff_court_day", { p_date: date }),
      supabase.from("offerings").select("*").eq("status", "published").ilike("location", "%court%"),
      supabase.from("session_cancellations").select("offering_id, session_date").eq("session_date", date),
      // Only the contacts this person may see (RLS); facilitators type names in.
      supabase.from("contacts").select("id, name, email, phone").order("name"),
      supabase.from("court_prices").select("*").order("position"),
      supabase.from("court_config").select("key, value"),
    ]);
  const classes = sessions(offerings ?? [], cancels ?? [], date, date)
    .filter((s) => !s.cancelled)
    .map((s) => s.o);
  const cfg = Object.fromEntries((config ?? []).map((c) => [c.key, Number(c.value)]));
  return (
    <CourtsView
      courts={courts ?? []}
      bookings={(day ?? []) as unknown as SBooking[]}
      classes={classes}
      people={people ?? []}
      prices={prices ?? []}
      usdRate={cfg.usd_crc_rate ?? 455}
      vatPercent={cfg.vat_percent ?? 13}
      date={date}
      today={today}
      now={new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Costa_Rica" }).format(new Date())}
      canManage={staff.role === "admin" || staff.role === "lead" || staff.role === "community_manager"}
    />
  );
}
