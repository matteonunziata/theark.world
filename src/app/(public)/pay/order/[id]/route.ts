import { createCheckout, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderCheckout } from "@/lib/ticket-checkout";

// Pay for a cart of bookings on Stripe's own page: the fallback for when the payment form
// can't sit inside the page. One payment covers every booking in the order.

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const back = new URL("/", request.url);
  const admin = createAdminClient();
  if (!admin || !stripeReady() || !/^[0-9a-f-]{36}$/i.test(id)) return Response.redirect(back, 303);
  const t = await orderCheckout(admin, id);
  if (!t.ok) return Response.redirect(back, 303);
  try {
    return Response.redirect(await createCheckout(t.input), 303);
  } catch (e) {
    console.error("Order checkout failed", e);
    return Response.redirect(new URL("/pay/done?problem=stripe", request.url), 303);
  }
}
