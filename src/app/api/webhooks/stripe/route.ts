import type Stripe from "stripe";
import { fulfillCheckout, stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe → ARK OS. In the Stripe dashboard (Developers → Webhooks), point an
// endpoint at /api/webhooks/stripe with these events, and put its signing
// secret in STRIPE_WEBHOOK_SECRET:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   refund.created
// A payment is recorded once however many times Stripe sends it. Errors
// answer 500 so Stripe tries again later.

export async function POST(request: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!s || !secret || !admin) return new Response("Not configured", { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const cs = event.data.object;
        if (cs.metadata?.kind && cs.payment_status !== "unpaid") await fulfillCheckout(cs.id);
        break;
      }
      case "refund.created": {
        const r = event.data.object;
        const intent = typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id;
        if (intent && r.status !== "failed" && r.status !== "canceled") {
          const { error } = await admin.rpc("refund_stripe_payment", {
            p_intent: intent,
            p_refund_id: r.id,
            p_amount: r.amount / 100,
            p_currency: r.currency,
          });
          if (error) throw new Error(error.message);
        }
        break;
      }
    }
  } catch (e) {
    console.error("Stripe webhook failed", event.type, event.id, e);
    return new Response("Couldn’t process", { status: 500 });
  }
  return Response.json({ received: true });
}
