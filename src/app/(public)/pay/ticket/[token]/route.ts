import { createCheckout, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketCheckout } from "@/lib/ticket-checkout";

// Pay for a booked ticket on Stripe's own page: the fallback for when the payment form
// can't sit inside the event page. The link carries the ticket's own token (the one in its
// QR code), so it works from the ticket page and the ticket email alike. What to charge is
// worked out in ticketCheckout, shared with the form on the event page. Anything that can't
// be paid here goes back to the ticket.

export async function GET(request: Request, ctx: RouteContext<"/pay/ticket/[token]">) {
  const { token } = await ctx.params;
  const back = new URL(`/t/${encodeURIComponent(token)}`, request.url);
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return Response.redirect(back, 303);

  const t = await ticketCheckout(admin, token);
  if (!t.ok) return Response.redirect(t.reason === "outside" && t.link ? t.link : back, 303);
  try {
    return Response.redirect(await createCheckout(t.input), 303);
  } catch (e) {
    console.error("Ticket checkout failed", e);
    return Response.redirect(new URL("/pay/done?problem=stripe", request.url), 303);
  }
}
