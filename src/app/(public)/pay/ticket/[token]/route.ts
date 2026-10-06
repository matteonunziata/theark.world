import { fmtDate } from "@/lib/dates";
import { createCheckout, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Pay for a booked ticket on Stripe. The link carries the ticket's own token
// (the one in its QR code), so it works from the booking page, the ticket
// page and the ticket email alike. Anything that can't be paid here goes back
// to the ticket.

export async function GET(request: Request, ctx: RouteContext<"/pay/ticket/[token]">) {
  const { token } = await ctx.params;
  const back = new URL(`/t/${encodeURIComponent(token)}`, request.url);
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return Response.redirect(back, 303);

  const { data: r } = await admin
    .from("registrations")
    .select(
      "id, name, email, paid, session_date, contact_id, offering:offerings(title, status), ticket:ticket_types(name, price, currency, payment_link)",
    )
    .eq("qr_token", token)
    .maybeSingle();
  if (!r || r.paid || !r.ticket || r.offering?.status !== "published") return Response.redirect(back, 303);
  if (r.ticket.payment_link) return Response.redirect(r.ticket.payment_link, 303);
  const price = Number(r.ticket.price);
  if (!(price > 0)) return Response.redirect(back, 303);

  const title = r.offering?.title ?? "Ticket";
  const day = fmtDate(r.session_date, { weekday: "short", month: "short", day: "numeric" });
  try {
    const url = await createCheckout({
      kind: "ticket",
      title: `${title}, ${day}`,
      description: r.ticket.name,
      amount: price,
      currency: r.ticket.currency,
      email: r.email,
      meta: {
        registration_id: r.id,
        token,
        name: r.name,
        email: r.email,
        contact_id: r.contact_id,
        description: `${title} (${r.ticket.name}), ${r.session_date}`,
      },
      cancelPath: `/t/${token}`,
    });
    return Response.redirect(url, 303);
  } catch (e) {
    console.error("Ticket checkout failed", e);
    return Response.redirect(new URL("/pay/done?problem=stripe", request.url), 303);
  }
}
