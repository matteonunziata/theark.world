import "server-only";
import { fmtDate } from "@/lib/dates";
import { type CheckoutInput, findStripePrice } from "@/lib/stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type TicketCheckout =
  | { ok: true; input: CheckoutInput; amount: number; currency: string; summary: string; held: boolean }
  | { ok: false; reason: "gone" | "paid" | "lapsed" | "outside"; link: string | null };

/**
 * What to charge for a booked ticket, found from its own token (the one in its QR code).
 * Used by the hosted Stripe page and by the payment form inside the event page, so both
 * charge the same amount. A booking with several tickets is charged as one order at the
 * prices it was booked at. A single meal ticket can use the Stripe product with its name
 * (found once and remembered on the ticket type).
 */
export async function ticketCheckout(admin: Admin, token: string): Promise<TicketCheckout> {
  const { data: r } = await admin
    .from("registrations")
    .select(
      "id, name, email, paid, status, hold_until, session_date, contact_id, offering:offerings(title, status), ticket:ticket_types(id, name, price, currency, payment_link, pay_first, stripe_price_id), items:registration_items(qty, unit_price, currency, ticket:ticket_types(name))",
    )
    .eq("qr_token", token)
    .maybeSingle();
  if (!r || !r.ticket || r.offering?.status !== "published") return { ok: false, reason: "gone", link: null };
  if (r.paid) return { ok: false, reason: "paid", link: null };
  // A hold that lapsed can't be paid; the ticket page says to book again.
  if (r.status === "held" && r.hold_until && new Date(r.hold_until) <= new Date()) {
    return { ok: false, reason: "lapsed", link: null };
  }

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
  if (!priceId && !(amount > 0)) return { ok: false, reason: "outside", link: r.ticket.payment_link };

  const title = r.offering?.title ?? "Ticket";
  const day = fmtDate(r.session_date, { weekday: "short", month: "short", day: "numeric" });
  return {
    ok: true,
    amount,
    currency,
    summary: what,
    held: r.status === "held",
    input: {
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
    },
  };
}
