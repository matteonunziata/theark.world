import { icsFile } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

// Apple Calendar / Outlook file for one booking, keyed by its ticket token.
export async function GET(_req: Request, ctx: RouteContext<"/t/[token]/calendar.ics">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const [{ data: t }, { data: org }] = await Promise.all([
    supabase.rpc("ticket_by_token", { p_token: token }).maybeSingle(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  if (!t) return new Response("Ticket not found", { status: 404 });
  const body = icsFile({
    uid: t.registration_id,
    title: `${t.title} · ${org?.name ?? "The ARK"}`,
    date: t.session_date,
    start: t.start_time,
    end: t.end_time,
    location: [t.location, org?.location].filter(Boolean).join(", "),
    details: `Your ticket: ${new URL(`/t/${token}`, _req.url)}`,
    timeZone: org?.timezone,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="the-ark-${t.session_date}.ics"`,
    },
  });
}
