import "server-only";
import { getViewer } from "@/lib/auth";
import { coverUrl } from "@/lib/covers";
import { addDays, nowIn, todayIn } from "@/lib/dates";
import { bookingClosed } from "@/lib/facilitator-pay";
import { sessions } from "@/lib/schedule";

/** Everything the booking page (and the portal's booking modal) shows. */
export async function loadEvent(id: string, date?: string | null) {
  const { supabase, staff, memberId } = await getViewer();
  const [{ data: org }, { data: o }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.from("offerings").select("*").eq("id", id).maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const viewer = { staff: !!staff, memberId, orgName };
  if (!o || o.status !== "published") return { ...viewer, event: null };

  const today = todayIn(org?.timezone);
  const now = nowIn(org?.timezone);
  const to = addDays(today, 120);
  const [{ data: tickets }, { data: cancels }, { data: counts }, { data: facs }, { data: going }] =
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
    ]);
  const attendees: Record<string, Attendee[]> = {};
  for (const a of going ?? []) (attendees[a.session_date] ??= []).push(a);
  const all = sessions([o], cancels ?? [], today, to);
  const upcoming = all.slice(0, 8);
  // Keep the date someone picked, even when it's further out.
  const asked = date && !upcoming.some((s) => s.date === date) && all.find((s) => s.date === date);
  if (asked) upcoming.push(asked);
  return {
    ...viewer,
    event: {
      o,
      today,
      cover: coverUrl(o.cover_path),
      facilitator: (facs ?? []).find((x) => x.id === o.facilitator_id)?.name ?? null,
      tickets: tickets ?? [],
      counts: counts ?? [],
      sessions: upcoming.map((s) => ({ date: s.date, cancelled: s.cancelled, closed: bookingClosed(o, s.date, now) })),
      attendees,
      canBook: !!memberId || (o.kind !== "class" && o.access === "everyone"),
    },
  };
}

export type Attendee = { session_date: string; id: string; name: string; photo_path: string | null; is_me: boolean };

export type LoadedEvent = NonNullable<Awaited<ReturnType<typeof loadEvent>>["event"]>;
