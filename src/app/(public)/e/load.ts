import "server-only";
import { getViewer } from "@/lib/auth";
import { coverUrl } from "@/lib/covers";
import { addDays, nowIn, todayIn } from "@/lib/dates";
import { bookingClosed } from "@/lib/facilitator-pay";
import { sessions } from "@/lib/schedule";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Everything the booking page (and the portal's booking modal) shows.
 * `id` is the event's id or its clean link (slug). */
export async function loadEvent(id: string, date?: string | null) {
  const { supabase, staff, memberId } = await getViewer();
  const [{ data: org }, { data: o }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.from("offerings").select("*").eq(UUID.test(id) ? "id" : "slug", id).maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const viewer = { staff: !!staff, memberId, orgName };
  if (!o || o.status !== "published") return { ...viewer, event: null };

  const today = todayIn(org?.timezone);
  const now = nowIn(org?.timezone);
  const to = addDays(today, 120);
  const [{ data: tickets }, { data: cancels }, { data: counts }, { data: facs }, { data: going }, { data: schedule }, { data: images }] =
    await Promise.all([
      supabase.from("ticket_types").select("*").eq("offering_id", o.id).order("position"),
      supabase
        .from("session_cancellations")
        .select("offering_id, session_date")
        .eq("offering_id", o.id)
        .gte("session_date", today),
      supabase.rpc("session_counts", { p_offering_id: o.id, p_from: today, p_to: to }),
      supabase.rpc("facilitator_names"),
      // Who else is going: members and staff only; the function returns
      // nothing to anyone else.
      memberId || staff
        ? supabase.rpc("session_attendees", { p_offering_id: o.id, p_from: today, p_to: to })
        : Promise.resolve({ data: [] as Attendee[] }),
      supabase.from("event_schedule_items").select("*").eq("offering_id", o.id).order("day").order("start_time"),
      supabase.from("event_images").select("*").eq("offering_id", o.id).order("position"),
    ]);
  // Booking stops at the cut-off date and time, in the venue's time zone.
  const registrationClosed = !!o.booking_closes_at && o.booking_closes_at.slice(0, 16) <= now;
  const attendees: Record<string, Attendee[]> = {};
  for (const a of going ?? []) (attendees[a.session_date] ??= []).push(a);
  const all = sessions([o], cancels ?? [], today, to);
  const upcoming = all.slice(0, 8);
  // Keep the date someone picked, even when it's further out.
  const asked = date && !upcoming.some((s) => s.date === date) && all.find((s) => s.date === date);
  if (asked) upcoming.push(asked);
  // Where each ticket stands (on sale, sold out, opens later) and how many are taken, per date.
  const open = upcoming.filter((s) => !s.cancelled).map((s) => s.date);
  const availList = await Promise.all(
    open.map((d) => supabase.rpc("ticket_availability", { p_offering_id: o.id, p_date: d })),
  );
  const availability: Record<string, Record<string, { state: string; taken: number }>> = {};
  open.forEach((d, i) => {
    availability[d] = Object.fromEntries(
      (availList[i].data ?? []).map((a) => [a.ticket_type_id, { state: a.state, taken: a.taken }]),
    );
  });
  const forDate = date && availability[date] ? date : (open[0] ?? today);
  const states: Record<string, string> = Object.fromEntries(
    Object.entries(availability[forDate] ?? {}).map(([id, a]) => [id, a.state]),
  );
  return {
    ...viewer,
    event: {
      o,
      today,
      cover: coverUrl(o.cover_path),
      facilitator: (facs ?? []).find((x) => x.id === o.facilitator_id)?.name ?? null,
      tickets: tickets ?? [],
      states,
      availability,
      schedule: schedule ?? [],
      images: (images ?? []).map((x) => coverUrl(x.path)).filter((x): x is string => !!x),
      registrationClosed,
      counts: counts ?? [],
      sessions: upcoming.map((s) => ({ date: s.date, cancelled: s.cancelled, closed: registrationClosed || bookingClosed(o, s.date, now) })),
      attendees,
      canBook: !!memberId || (o.kind !== "class" && o.access === "everyone"),
    },
  };
}

export type Attendee = { session_date: string; id: string; name: string; photo_path: string | null; is_me: boolean };

export type LoadedEvent = NonNullable<Awaited<ReturnType<typeof loadEvent>>["event"]>;
