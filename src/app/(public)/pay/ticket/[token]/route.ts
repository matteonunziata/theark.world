import { fmtDate } from "@/lib/dates";
import { createCheckout, findStripePrice, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Pay for a booked ticket on Stripe. The link carries the ticket's own token
// (the one in its QR code), so it works from the booking page, the ticket
// page and the ticket email alike. Meals charge the Stripe product with the
// ticket's name (found once and remembered on the ticket type), so nobody is
// sent to an outside payment link while Stripe is on. Anything that can't be
// paid here goes back to the ticket.

export async function GET(request: Request, ctx: RouteContext<"/pay/ticket/[token]">) {
  const { token } = await ctx.params;
  const back = new URL(`/t/${encodeURIComponent(token)}`, request.url);
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return Response.redirect(back, 303);

  const { data: r } = await admin
    .from("registrations")
    .select(
      "id, name, email, paid, status, hold_until, session_date, contact_id, offering:offerings(title, status), ticket:ticket_types(id, name, price, currency, payment_link, pay_first, stripe_price_id), items:registration_items(qty, unit_price, currency, ticket:ticket_types(name))",
    )
    .eq("qr_token", token)
    .maybeSingle();
  if (!r || r.paid || !r.ticket || r.offering?.status !== "published") return Response.redirect(back, 303);
  // A hold that lapsed can't be paid; the ticket page says to book again.
  if (r.status === "held" && r.hold_until && new Date(r.hold_until) <= new Date()) return Response.redirect(back, 303);

  let priceId = r.ticket.stripe_price_id;
  let amount = Number(r.ticket.price);
  let currency = r.ticket.currency;
  // More than one ticket, or an add-on: charge the whole order at the prices it was booked at.
  const items = r.items ?? [];
  const order = items.length > 1 || (items.length === 1 && items[0].qty > 1);
  let what = r.ticket.name;
  if (order && new Set(items.map((i) => i.currency)).size === 1) {
    priceId = null;
    amount = items.reduce((n, i) => n + Number(i.unit_price) * i.qty, 0);
    currency = items[0].currency;
    what = items.map((i) => `${i.qty} × ${i.ticket?.name ?? "Ticket"}`).join(", ");
  }
  if (!order && !priceId && !(amount > 0)) {
    const found = await findStripePrice(r.ticket.name).catch(() => null);
    if (found) {
      priceId = found.priceId;
      amount = found.amount;
      currency = found.currency;
      await admin
        .from("ticket_types")
        .update({ stripe_price_id: found.priceId, price: found.amount, currency: found.currency })
        .eq("id", r.ticket.id);
    }
  }
  if (!priceId && !(amount > 0)) {
    return Response.redirect(r.ticket.payment_link ?? back, 303);
  }

  const title = r.offering?.title ?? "Ticket";
  const day = fmtDate(r.session_date, { weekday: "short", month: "short", day: "numeric" });
  try {
    const url = await createCheckout({
      kind: "ticket",
      title: `${title}, ${day}`,
      description: what,
      priceId,
      amount,
      currency,
      email: r.email,
      meta: {
        registration_id: r.id,
        token,
        name: r.name,
        email: r.email,
        contact_id: r.contact_id,
        held: r.status === "held" ? "1" : null,
        description: `${title} (${what}), ${r.session_date}`,
      },
      cancelPath: `/t/${token}`,
    });
    return Response.redirect(url, 303);
  } catch (e) {
    console.error("Ticket checkout failed", e);
    return Response.redirect(new URL("/pay/done?problem=stripe", request.url), 303);
  }
}
