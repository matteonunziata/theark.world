import { fmtDate, timeRange } from "@/lib/dates";
import { createCheckout, stripeReady } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Pay for a court on Stripe. The link carries the player's own token (the
// host's for a plain booking; each joiner's for an open match), so the same
// link works from the booking page and the email. Anything that can't be paid
// here goes back to the booking page, which says why.

type Page = {
  booking: { court: string; date: string; start_time: string; end_time: string; status: string; open_match: boolean; spots: number | null; currency: string };
  you: { id: string; token: string; name: string; email: string | null; amount: number; paid: boolean; status: string; host: boolean } | null;
};

export async function GET(request: Request, ctx: RouteContext<"/pay/court/[token]">) {
  const { token } = await ctx.params;
  const back = new URL(`/courts/b/${encodeURIComponent(token)}`, request.url);
  if (!stripeReady()) return Response.redirect(back, 303);

  const supabase = await createClient();
  const { data } = await supabase.rpc("court_booking_by_token", { p_token: token });
  const d = data as Page | null;
  const you = d?.you;
  if (!d || !you || you.paid || !(Number(you.amount) > 0)) return Response.redirect(back, 303);
  if (!["held", "in"].includes(you.status) || !["held", "booked"].includes(d.booking.status)) {
    return Response.redirect(back, 303);
  }

  const day = fmtDate(d.booking.date, { weekday: "short", month: "short", day: "numeric" });
  const time = timeRange({ start_time: d.booking.start_time, end_time: d.booking.end_time });
  const title = `${d.booking.court}, ${day} ${time}`;
  try {
    const url = await createCheckout({
      kind: "court",
      title,
      description: d.booking.open_match
        ? `Your share of an open match (${d.booking.spots ?? 4} players)`
        : "Court booking at The ARK, Santa Teresa",
      amount: Number(you.amount),
      currency: d.booking.currency ?? "CRC",
      email: you.email,
      meta: {
        court_player_id: you.id,
        token: you.token,
        name: you.name,
        email: you.email,
        description: `${d.booking.court}, ${d.booking.date} ${d.booking.start_time.slice(0, 5)}–${d.booking.end_time.slice(0, 5)}${d.booking.open_match ? " (open match share)" : ""}`,
      },
      cancelPath: `/courts/b/${you.token}`,
    });
    return Response.redirect(url, 303);
  } catch (e) {
    console.error("Court checkout failed", e);
    return Response.redirect(new URL("/pay/done?problem=stripe", request.url), 303);
  }
}
