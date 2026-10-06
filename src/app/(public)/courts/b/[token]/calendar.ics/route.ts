import { icsFile } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

// Apple Calendar / Outlook file for one court booking, keyed by a booking or player token.
export async function GET(req: Request, ctx: RouteContext<"/courts/b/[token]/calendar.ics">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const [{ data }, { data: org }] = await Promise.all([
    supabase.rpc("court_booking_by_token", { p_token: token }),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const d = data as { booking: { id: string; court: string; date: string; start_time: string; end_time: string } } | null;
  if (!d) return new Response("Booking not found", { status: 404 });
  const body = icsFile({
    uid: `court-${d.booking.id}`,
    title: `${d.booking.court} · ${org?.name ?? "The ARK"}`,
    date: d.booking.date,
    start: d.booking.start_time,
    end: d.booking.end_time,
    location: [org?.name ?? "The ARK", org?.location].filter(Boolean).join(", "),
    details: `Your booking: ${new URL(`/courts/b/${token}`, req.url)}`,
    timeZone: org?.timezone,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="the-ark-court-${d.booking.date}.ics"`,
    },
  });
}
